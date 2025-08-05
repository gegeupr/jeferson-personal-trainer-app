// src/app/api/stripe/create-checkout-session/route.ts
// @ts-nocheck // Mantemos para evitar problemas de tipagem com o Stripe SDK

import { NextResponse } from 'next/server';
import { MercadoPagoConfig, PreApproval } from 'mercadopago'; // Pode remover se não usar mais MP
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js'; // <--- CORREÇÃO AQUI: Importa createClient

// Credenciais do Stripe
const stripeSecretKey = process.env.STRIPE_SECRET_KEY as string;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

// Credenciais do Supabase para o cliente ADMIN (APENAS SERVER-SIDE)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// URL base da aplicação para redirecionamento
const appBaseUrl = process.env.NEXT_PUBLIC_VERCEL_URL 
  ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL.replace('https://', '')}`
  : 'http://localhost:3000'; // Em localhost, Stripe pode ser mais flexível com http.


if (!stripeSecretKey || !stripe) {
  console.error('ERRO DE CONFIG: Chave secreta do Stripe não configurada.');
}
if (!supabaseUrl || !serviceRoleKey) {
  console.error('ERRO DE CONFIG: Supabase URL ou Service Role Key não definidos para cliente admin.');
}

let supabaseAdminClient: ReturnType<typeof createClient> | null = null;
if (supabaseUrl && serviceRoleKey) {
    supabaseAdminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        }
    });
}


export async function POST(request: Request) {
  if (!stripe || !stripeSecretKey) {
    return NextResponse.json({ error: 'Erro de servidor: Chave secreta do Stripe não configurada.' }, { status: 500 });
  }
  if (!supabaseAdminClient) {
    return NextResponse.json({ error: 'Erro de servidor: Cliente Supabase Admin não configurado.' }, { status: 500 });
  }

  try {
    const { alunoId } = await request.json();

    if (!alunoId) {
      return NextResponse.json({ error: 'ID do aluno é obrigatório.' }, { status: 400 });
    }

    // 1. Buscar o email do aluno no Supabase (usando supabaseAdminClient)
    const { data: authUserData, error: authUserError } = await supabaseAdminClient.auth.admin.getUserById(alunoId);
    
    const alunoEmail = authUserData?.user?.email;
    if (authUserError || !alunoEmail) {
        console.error('Erro ao buscar usuário pelo ID para Stripe Checkout:', authUserError?.message || 'Email do usuário não encontrado');
        return NextResponse.json({ error: 'Informações do aluno (email) não encontradas para o pagamento.' }, { status: 404 });
    }
    
    const { data: profileData, error: profileError } = await supabaseAdminClient // Usando supabaseAdminClient
        .from('profiles')
        .select('nome_completo')
        .eq('id', alunoId)
        .single();
    
    const alunoNome = profileData?.nome_completo || 'Aluno';


    // 2. Opcional: Verificar se o aluno já tem uma assinatura ativa/pendente (usando supabaseAdminClient)
    const { data: existingSubscription, error: subError } = await supabaseAdminClient // Usando supabaseAdminClient
        .from('assinaturas')
        .select('id, status')
        .eq('aluno_id', alunoId)
        .in('status', ['active', 'pending']);
    
    if (subError) {
        console.error('Erro ao verificar assinatura existente no Supabase (ADMIN):', subError.message);
        return NextResponse.json({ error: 'Erro ao verificar assinatura existente.' }, { status: 500 });
    }

    if (existingSubscription && existingSubscription.length > 0) {
        return NextResponse.json({ 
            error: 'Você já possui uma assinatura ativa ou pendente.',
            redirectUrl: existingSubscription[0].status === 'pending' ? `https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=` + process.env.MP_PLAN_ID_MENSAL_TEST : '/dashboard' // Se ainda tiver Mercado Pago no .env
        }, { status: 409 });
    }


    // 3. Criar a sessão de checkout do Stripe
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: 'Plano Mensal Treino JP',
              description: 'Acesso mensal a todas as funcionalidades exclusivas.',
            },
            unit_amount: 15000, // R$ 150,00 em centavos
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      customer_email: alunoEmail,
      client_reference_id: alunoId,
      success_url: `${appBaseUrl}/aluno/assinatura/status?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appBaseUrl}/aluno/assinatura`,
      locale: 'pt',
      payment_method_types: ['card', 'boleto'], // Removido 'pix'
    });

    if (!checkoutSession.url) {
        throw new Error('Não foi possível obter a URL da sessão de checkout do Stripe.');
    }

    // 4. Salvar o status inicial da assinatura no Supabase (usando cliente admin)
    const { data: newSubscription, error: insertError } = await supabaseAdminClient
        .from('assinaturas')
        .insert({
            aluno_id: alunoId,
            plano_mp_id: 'plano_mensal_stripe', // Um identificador para o plano Stripe
            status: 'pending',
            preapproval_id_mp: checkoutSession.id, // Usamos o ID da sessão de checkout aqui
            data_inicio: new Date().toISOString(),
            // next_payment_date será atualizada pelo webhook após o sucesso
        })
        .select()
        .single();

    if (insertError) {
        console.error('Erro ao salvar assinatura inicial no Supabase (ADMIN):', insertError.message);
        return NextResponse.json({ error: 'Erro ao registrar assinatura no sistema.' }, { status: 500 });
    }

    return NextResponse.json({ redirectUrl: checkoutSession.url });

  } catch (error: any) {
    console.error('Erro geral na API Route de Checkout Stripe:', error.message || error);
    return NextResponse.json({ error: `Erro ao iniciar assinatura: ${error.message || 'Erro desconhecido'}` }, { status: 500 });
  }
}