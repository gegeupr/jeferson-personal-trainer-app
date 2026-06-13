import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

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

// current_period_* mudou de lugar entre versões da API; lemos de forma defensiva.
function periods(sub: Stripe.Subscription) {
  const s = sub as unknown as {
    current_period_start?: number;
    current_period_end?: number;
  };
  return {
    current_period_start: s.current_period_start
      ? new Date(s.current_period_start * 1000).toISOString()
      : null,
    current_period_end: s.current_period_end
      ? new Date(s.current_period_end * 1000).toISOString()
      : null,
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
