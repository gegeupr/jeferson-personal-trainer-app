// src/app/api/stripe/webhook/route.ts
// @ts-nocheck // Mantém para evitar problemas de tipagem do Stripe SDK

import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  // ⚠️ Inicializar Stripe e Supabase aqui dentro, não no topo do módulo
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeWebhookSecret || !stripeSecretKey) {
    console.error('ERRO DE CONFIG: Stripe Webhook Secret ou API Key não definidos.');
    return new NextResponse('Erro de configuração do Stripe', { status: 500 });
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const body = await req.text();
  const signature = headers().get('stripe-signature') as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret);
  } catch (err: any) {
    console.error(`Erro de verificação da assinatura do Webhook: ${err.message}`);
    return new NextResponse(`Erro de Webhook: ${err.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const checkoutSession = event.data.object as Stripe.CheckoutSession;
        const alunoIdFromStripe = checkoutSession.client_reference_id;
        const stripeCheckoutSessionId = checkoutSession.id;
        const stripeSubscriptionId = checkoutSession.subscription;

        console.log(
          `Evento: checkout.session.completed para aluno ${alunoIdFromStripe}, session ID: ${stripeCheckoutSessionId}`
        );

        if (alunoIdFromStripe && stripeCheckoutSessionId && stripeSubscriptionId) {
          const { data: existingSub, error: fetchError } = await supabaseAdmin
            .from('assinaturas')
            .select('*')
            .eq('aluno_id', alunoIdFromStripe)
            .eq('preapproval_id_mp', stripeCheckoutSessionId)
            .single();

          if (fetchError && fetchError.code !== 'PGRST116') {
            console.error('Erro ao buscar assinatura existente no Supabase:', fetchError.message);
            return new NextResponse('Erro interno do servidor', { status: 500 });
          }

          if (existingSub) {
            const { error: updateError } = await supabaseAdmin
              .from('assinaturas')
              .update({
                status: 'active',
                data_inicio: new Date().toISOString(),
                preapproval_id_mp: stripeSubscriptionId as string,
                last_payment_date: new Date().toISOString(),
              })
              .eq('id', existingSub.id);

            if (updateError) {
              console.error('Erro ao atualizar assinatura no Supabase:', updateError.message);
            } else {
              console.log(`Assinatura ativa para aluno ${alunoIdFromStripe} atualizada no Supabase.`);
            }
          } else {
            console.warn(`Assinatura pendente não encontrada. Inserindo nova assinatura como ativa.`);
            const { error: insertError } = await supabaseAdmin.from('assinaturas').insert({
              aluno_id: alunoIdFromStripe,
              plano_mp_id: 'plano_mensal_stripe',
              status: 'active',
              preapproval_id_mp: stripeSubscriptionId as string,
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
      }

      case 'customer.subscription.updated': {
        const subscriptionUpdated = event.data.object as Stripe.Subscription;
        console.log(`Evento: customer.subscription.updated para ${subscriptionUpdated.id}`);
        if (subscriptionUpdated.metadata?.aluno_id) {
          const newStatus = subscriptionUpdated.status === 'active' ? 'active' : 'inactive';
          await supabaseAdmin
            .from('assinaturas')
            .update({ status: newStatus })
            .eq('aluno_id', subscriptionUpdated.metadata.aluno_id)
            .eq('preapproval_id_mp', subscriptionUpdated.id);
        }
        break;
      }

      case 'customer.subscription.deleted': {
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
      }

      case 'invoice.payment_succeeded': {
        const invoiceSucceeded = event.data.object as Stripe.Invoice;
        console.log(`Evento: invoice.payment_succeeded para ${invoiceSucceeded.id}`);
        // Aqui você pode atualizar last_payment_date e next_payment_date no Supabase
        break;
      }

      case 'invoice.payment_failed': {
        const invoiceFailed = event.data.object as Stripe.Invoice;
        console.log(`Evento: invoice.payment_failed para ${invoiceFailed.id}`);
        // Aqui você pode marcar a assinatura como 'past_due' ou 'unpaid'
        break;
      }

      default:
        console.warn(`Tipo de evento Webhook não tratado: ${event.type}`);
    }
  } catch (error: any) {
    console.error('Erro ao processar evento Webhook:', error.message || error);
    return new NextResponse(`Erro ao processar evento: ${error.message || 'desconhecido'}`, { status: 500 });
  }

  return new NextResponse('OK', { status: 200 });
}
