import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const runtime = "nodejs";

type ProfStatus = "trial" | "active" | "past_due" | "canceled";

function mapStatus(s: string): ProfStatus | null {
  switch (s) {
    case "trialing":
      return "trial";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
    case "incomplete":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      return null;
  }
}

// current_period_* mudou de lugar entre versões da API: nas versões novas
// (2025-06-30+) saiu do topo da subscription e foi para items.data[0].
// Lemos do topo e caímos para o item se faltar.
function periods(sub: Stripe.Subscription) {
  const top = sub as unknown as {
    current_period_start?: number;
    current_period_end?: number;
  };
  const item = sub.items?.data?.[0] as unknown as
    | { current_period_start?: number; current_period_end?: number }
    | undefined;
  const start = top.current_period_start ?? item?.current_period_start;
  const end = top.current_period_end ?? item?.current_period_end;
  return {
    current_period_start: start ? new Date(start * 1000).toISOString() : null,
    current_period_end: end ? new Date(end * 1000).toISOString() : null,
  };
}

function customerId(
  c: string | { id: string } | null | undefined
): string | null {
  if (!c) return null;
  return typeof c === "string" ? c : c.id;
}

async function syncFromSubscription(
  admin: SupabaseClient,
  sub: Stripe.Subscription
) {
  const professorId = sub.metadata?.professor_id || null;
  const status = mapStatus(sub.status);
  const patch = {
    stripe_subscription_id: sub.id,
    stripe_customer_id: customerId(sub.customer),
    ...(status ? { status } : {}),
    ...periods(sub),
  };
  // casa por professor_id (preferido) ou pelo id da subscription
  const q = admin.from("professor_assinaturas").update(patch);
  if (professorId) await q.eq("professor_id", professorId);
  else await q.eq("stripe_subscription_id", sub.id);
}

export async function POST(req: Request) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeSecretKey || !stripeWebhookSecret) {
    return new NextResponse("Stripe não configurado", { status: 500 });
  }

  const stripe = new Stripe(stripeSecretKey);
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const body = await req.text();
  const h = await headers();
  const signature = h.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "assinatura inválida";
    return new NextResponse(`Webhook error: ${msg}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const professorId = s.metadata?.professor_id;
        if (professorId && s.subscription) {
          const sub = await stripe.subscriptions.retrieve(
            s.subscription as string
          );
          await admin
            .from("professor_assinaturas")
            .update({
              stripe_customer_id: customerId(s.customer),
              stripe_subscription_id: sub.id,
              status: mapStatus(sub.status) ?? "active",
              ...periods(sub),
            })
            .eq("professor_id", professorId);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        await syncFromSubscription(
          admin,
          event.data.object as Stripe.Subscription
        );
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const professorId = sub.metadata?.professor_id || null;
        const q = admin
          .from("professor_assinaturas")
          .update({ status: "canceled" as ProfStatus });
        if (professorId) await q.eq("professor_id", professorId);
        else await q.eq("stripe_subscription_id", sub.id);
        break;
      }

      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        const subId =
          (inv as unknown as { subscription?: string | null }).subscription ??
          null;
        if (subId) {
          await admin
            .from("professor_assinaturas")
            .update({ status: "past_due" as ProfStatus })
            .eq("stripe_subscription_id", subId);

          // Notificar professor por email (best-effort)
          try {
            const resendKey = process.env.RESEND_API_KEY;
            if (resendKey) {
              const { data: assinData } = await admin
                .from("professor_assinaturas")
                .select("professor_id")
                .eq("stripe_subscription_id", subId)
                .maybeSingle();

              if (assinData?.professor_id) {
                const { data: userData } = await admin.auth.admin.getUserById(
                  assinData.professor_id
                );
                const email = userData?.user?.email;
                const { data: profileData } = await admin
                  .from("profiles")
                  .select("nome_completo")
                  .eq("id", assinData.professor_id)
                  .maybeSingle();

                if (email) {
                  const resend = new Resend(resendKey);
                  const siteUrl =
                    process.env.NEXT_PUBLIC_SITE_URL ||
                    "https://www.motionpersonal.com.br";
                  const nome = profileData?.nome_completo || "Professor";

                  await resend.emails.send({
                    from: "Motion <noreply@motionpersonal.com.br>",
                    to: email,
                    subject: "⚠️ Pagamento não processado — Motion",
                    html: `
                      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0a0a0a;color:#fff;padding:32px;border-radius:12px">
                        <h2 style="margin:0 0 8px">⚠️ Não conseguimos processar seu pagamento</h2>
                        <p style="color:#aaa;margin:0 0 24px">Olá, ${nome}.</p>
                        <p>Houve uma falha ao cobrar sua assinatura do <strong>Plano Professor — R$ 59,90/mês</strong>.</p>
                        <p style="color:#aaa">Isso pode ter acontecido por saldo insuficiente, cartão expirado ou bloqueio do banco.</p>
                        <p style="color:#f87171;font-weight:600;margin-top:16px">Seu acesso à plataforma foi suspenso até a regularização.</p>
                        <hr style="border-color:#333;margin:24px 0"/>
                        <p>Para reativar sua conta, acesse a plataforma e atualize seu método de pagamento:</p>
                        <a href="${siteUrl}/professor/pricing" style="display:inline-block;margin-top:12px;background:#fff;color:#000;padding:10px 20px;border-radius:8px;font-weight:700;text-decoration:none">
                          Regularizar pagamento
                        </a>
                        <p style="color:#555;font-size:12px;margin-top:24px">Motion · Sistema para Personal Trainers</p>
                      </div>
                    `,
                  });
                }
              }
            }
          } catch {
            // email é best-effort
          }
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const inv = event.data.object as Stripe.Invoice;
        const subId =
          (inv as unknown as { subscription?: string | null }).subscription ??
          null;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          await syncFromSubscription(admin, sub);
        }
        break;
      }

      default:
        break;
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "erro desconhecido";
    return new NextResponse(`Erro ao processar evento: ${msg}`, { status: 500 });
  }

  return new NextResponse("OK", { status: 200 });
}
