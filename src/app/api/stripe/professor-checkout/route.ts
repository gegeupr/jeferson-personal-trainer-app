import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

export const runtime = "nodejs";

export async function POST() {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: "Stripe não configurado." }, { status: 500 });
  }
  const stripe = new Stripe(stripeKey);

  // 1) Usuário vem da SESSÃO (cookie), nunca do body
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // 2) Confirma que é professor
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "professor") {
    return NextResponse.json(
      { error: "Apenas professores assinam o plano." },
      { status: 403 }
    );
  }

  // 3) Estado atual da assinatura (reusa customer; respeita trial restante)
  const { data: assin } = await admin
    .from("professor_assinaturas")
    .select("stripe_customer_id, status, trial_ends_at")
    .eq("professor_id", user.id)
    .maybeSingle();

  if (assin?.status === "active") {
    return NextResponse.json(
      { error: "Você já tem uma assinatura ativa." },
      { status: 409 }
    );
  }

  // Mantém os dias de trial que ainda restam (só se faltar > 2 dias, mínimo seguro do Stripe)
  let trialEnd: number | undefined;
  if (assin?.trial_ends_at) {
    const t = Math.floor(new Date(assin.trial_ends_at).getTime() / 1000);
    if (t > Math.floor(Date.now() / 1000) + 2 * 24 * 3600) trialEnd = t;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: assin?.stripe_customer_id || undefined,
    customer_email: assin?.stripe_customer_id ? undefined : user.email ?? undefined,
    line_items: [
      {
        price_data: {
          currency: "brl",
          product_data: {
            name: "Motion — Plano Professor",
            description: "Acesso mensal à plataforma Motion.",
          },
          unit_amount: 5990, // R$ 59,90
          recurring: { interval: "month" },
        },
        quantity: 1,
      },
    ],
    subscription_data: {
      metadata: { professor_id: user.id }, // <- webhook casa por aqui
      ...(trialEnd ? { trial_end: trialEnd } : {}),
    },
    metadata: { professor_id: user.id },
    success_url: `${siteUrl}/professor/dashboard?assinatura=sucesso`,
    cancel_url: `${siteUrl}/professor/pricing?assinatura=cancelado`,
    locale: "pt-BR",
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: session.url });
}
