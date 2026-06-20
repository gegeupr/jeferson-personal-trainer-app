import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

export const runtime = "nodejs";

export async function POST() {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey)
    return NextResponse.json({ error: "Stripe não configurado." }, { status: 500 });

  const stripe = new Stripe(stripeKey);

  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: assin } = await admin
    .from("professor_assinaturas")
    .select("stripe_customer_id")
    .eq("professor_id", user.id)
    .maybeSingle();

  if (!assin?.stripe_customer_id)
    return NextResponse.json({ error: "Nenhuma assinatura encontrada." }, { status: 404 });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: assin.stripe_customer_id,
    return_url: `${siteUrl}/professor/pricing`,
  });

  return NextResponse.json({ url: portalSession.url });
}
