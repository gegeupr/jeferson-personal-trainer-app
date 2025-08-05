// src/app/api/stripe/webhook/route.ts
// @ts-nocheck // Mantemos para evitar problemas de tipagem com o Stripe SDK

import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/utils/supabaseAdmin';

const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

export async function POST(req: Request) {
  const body = await req.text();
  const signature = headers().get('stripe-signature') as string;

  if (!stripeWebhookSecret || !stripeSecretKey || !stripe) {
    console.error('ERRO DE CONFIG: Stripe Webhook Secret ou API Key não definidos.');
    return new NextResponse('Erro de configuração do Stripe', { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      stripeWebhookSecret
    );
  } catch (err: any) {
    console.error(`Erro de verificação da assinatura do Webhook: ${err.message}`);
    return new NextResponse(`Erro de Webhook: ${err.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const checkoutSession = event.data.object as Stripe.CheckoutSession;
        const alunoIdFromStripe = checkoutSession.client_reference_id; // ID do aluno que passamos
        const stripeCheckoutSessionId = checkoutSession.id; // ID da sessão de checkout do Stripe
        const stripeSubscriptionId = checkoutSession.subscription; // ID da assinatura recorrente do Stripe

        console.log(`Evento: checkout.session.completed para aluno ${alunoIdFromStripe}, session ID: ${stripeCheckoutSessionId}`);

        if (alunoIdFromStripe && stripeCheckoutSessionId && stripeSubscriptionId) {
            // Tenta encontrar a assinatura pendente usando o ID da sessão de checkout
            const { data: existingSub, error: fetchError } = await supabaseAdmin
                .from('assinaturas')
                .select('*')
                .eq('aluno_id', alunoIdFromStripe)
                .eq('preapproval_id_mp', stripeCheckoutSessionId) // preapproval_id_mp agora guarda o ID da sessão de checkout
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = No rows found
                console.error('Erro ao buscar assinatura existente para atualização no Supabase:', fetchError.message);
                return new NextResponse('Erro interno do servidor', { status: 500 });
            }

            if (existingSub) {
                // Se encontrou, atualiza o status
                const { error: updateError } = await supabaseAdmin
                    .from('assinaturas')
                    .update({
                        status: 'active',
                        data_inicio: new Date().toISOString(),
                        preapproval_id_mp: stripeSubscriptionId as string, // Agora guarda o ID da assinatura Stripe
                        last_payment_date: new Date().toISOString(),
                        // Você pode adicionar lógica para next_payment_date aqui ou em 'invoice.payment_succeeded'
                    })
                    .eq('id', existingSub.id); // Atualiza pelo ID da linha encontrada

                if (updateError) {
                    console.error('Erro ao atualizar assinatura para ativa no Supabase:', updateError.message);
                } else {
                    console.log(`Assinatura ativa para aluno ${alunoIdFromStripe} atualizada no Supabase.`);
                }
            } else {
                // Se não encontrou (ex: webhook chegou antes da inserção inicial, ou erro na inserção inicial),
                // insere uma nova assinatura diretamente como ativa.
                console.warn(`Assinatura pendente não encontrada para ${alunoIdFromStripe}. Inserindo nova assinatura como ativa.`);
                const { error: insertError } = await supabaseAdmin
                    .from('assinaturas')
                    .insert({
                        aluno_id: alunoIdFromStripe,
                        plano_mp_id: 'plano_mensal_stripe', // ID do seu plano Stripe
                        status: 'active',
                        preapproval_id_mp: stripeSubscriptionId as string, // ID da assinatura Stripe
                        data_inicio: new Date().toISOString(),
                        last_payment_date: new Date().toISOString(),
                    });
                if (insertError) {
                    console.error('Erro ao inserir nova assinatura ativa no Supabase:', insertError.message);
                } else {
                    console.log(`Nova assinatura ativa para aluno ${alunoIdFromStripe} inserida no Supabase.`);
                }
            }
        }
        break;

      case 'customer.subscription.updated':
        const subscriptionUpdated = event.data.object as Stripe.Subscription;
        console.log(`Evento: customer.subscription.updated para ${subscriptionUpdated.id}`);
        // Você pode atualizar status, next_payment_date, etc. aqui.
        if (subscriptionUpdated.metadata?.aluno_id) { // Se você passar o aluno_id como metadata na assinatura
            const newStatus = subscriptionUpdated.status === 'active' ? 'active' : 'inactive'; // Exemplo
            await supabaseAdmin
                .from('assinaturas')
                .update({ status: newStatus })
                .eq('aluno_id', subscriptionUpdated.metadata.aluno_id)
                .eq('preapproval_id_mp', subscriptionUpdated.id); // O ID da assinatura Stripe
        }
        break;
        
      case 'customer.subscription.deleted':
        const subscriptionDeleted = event.data.object as Stripe.Subscription;
        console.log(`Evento: customer.subscription.deleted para ${subscriptionDeleted.id}`);
        if (subscriptionDeleted.metadata?.aluno_id) {
            await supabaseAdmin
                .from('assinaturas')
                .update({ status: 'cancelled' })
                .eq('aluno_id', subscriptionDeleted.metadata.aluno_id)
                .eq('preapproval_id_mp', subscriptionDeleted.id);
        }
        break;

      case 'invoice.payment_succeeded':
        const invoiceSucceeded = event.data.object as Stripe.Invoice;
        console.log(`Evento: invoice.payment_succeeded para ${invoiceSucceeded.id}`);
        // Atualize 'last_payment_date' e 'next_payment_date' no Supabase para pagamentos recorrentes
        if (invoiceSucceeded.subscription && invoiceSucceeded.customer_details?.email) {
            // Você precisaria de uma forma de mapear o customer_id ou subscription_id para o aluno_id
            // Uma forma é ter o aluno_id no metadata da subscription ou customer no Stripe
            // Por enquanto, vamos assumir que o checkout.session.completed já ativou.
            // Aqui você pode atualizar a data do próximo pagamento.
            // Ex: const nextPaymentDate = new Date(invoiceSucceeded.period_end * 1000).toISOString();
            // await supabaseAdmin.from('assinaturas').update({ next_payment_date: nextPaymentDate }).eq('preapproval_id_mp', invoiceSucceeded.subscription);
        }
        break;

      case 'invoice.payment_failed':
        const invoiceFailed = event.data.object as Stripe.Invoice;
        console.log(`Evento: invoice.payment_failed para ${invoiceFailed.id}`);
        // Marque a assinatura como 'past_due' ou 'unpaid' no Supabase
        if (invoiceFailed.subscription && invoiceFailed.customer_details?.email) {
            // await supabaseAdmin.from('assinaturas').update({ status: 'past_due' }).eq('preapproval_id_mp', invoiceFailed.subscription);
        }
        break;

      default:
        console.warn(`Tipo de evento Webhook não tratado: ${event.type}`);
    }
  } catch (error: any) {
    console.error('Erro ao processar evento Webhook:', error.message || error);
    return new NextResponse(`Erro ao processar evento: ${error.message || 'desconhecido'}`, { status: 500 });
  }

  return new NextResponse('OK', { status: 200 });
}