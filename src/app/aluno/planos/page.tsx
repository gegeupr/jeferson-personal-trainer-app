"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase-browser";

type ProfileAluno = {
  id: string;
  nome_completo: string | null;
  telefone: string | null;
  role: "aluno" | "professor" | null;
  professor_id: string | null;
};

type ProfileProfessor = {
  id: string;
  nome_completo: string | null;
};

type ProfessorPlano = {
  id: string;
  professor_id: string;
  duration_days: 30 | 90 | 180;
  title: string;
  description: string | null;
  price_cents: number | null;
  payment_url: string | null;
  whatsapp: string | null;
  is_active: boolean;
};

type AssinaturaLite = {
  id: string;
  status: "active" | "expired" | "canceled";
  start_at: string;
  end_at: string;
  duration_days: 30 | 90 | 180;
};

function onlyDigits(v: string) { return (v || "").replace(/\D/g, ""); }

function waLink(phoneRaw: string | null | undefined, msg: string) {
  const digits = onlyDigits(phoneRaw || "");
  if (!digits) return null;
  return `https://wa.me/${digits.startsWith("55") ? digits : `55${digits}`}?text=${encodeURIComponent(msg)}`;
}

function moneyBRLFromCents(cents?: number | null) {
  if (cents === null || cents === undefined) return "Consulte";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function daysLeft(endAt?: string | null) {
  if (!endAt) return null;
  return Math.floor((new Date(endAt).getTime() - Date.now()) / 86400000);
}

export default function AlunoPlanosPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [aluno, setAluno] = useState<ProfileAluno | null>(null);
  const [prof, setProf] = useState<ProfileProfessor | null>(null);
  const [planos, setPlanos] = useState<ProfessorPlano[]>([]);
  const [assinatura, setAssinatura] = useState<AssinaturaLite | null>(null);

  const alunoNome = useMemo(() => aluno?.nome_completo || "Aluno", [aluno?.nome_completo]);
  const profNome = useMemo(() => prof?.nome_completo || "Professor", [prof?.nome_completo]);

  const diasRestantes = useMemo(() => {
    if (!assinatura || assinatura.status !== "active") return null;
    return daysLeft(assinatura.end_at);
  }, [assinatura]);

  const recomendadoId = useMemo(() => planos.find((p) => p.duration_days === 90)?.id ?? null, [planos]);

  const waGeral = useMemo(() => {
    const wpp = planos[0]?.whatsapp;
    if (!wpp) return null;
    return waLink(wpp, `Olá ${profNome}! Eu sou ${alunoNome} (Motion). Acabei de realizar o pagamento e vou enviar o comprovante aqui.`);
  }, [planos, profNome, alunoNome]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setErrMsg(null);

      const { data: auth, error: authError } = await supabase.auth.getUser();
      const user = auth?.user;
      if (authError || !user) { router.replace("/login"); return; }

      const { data: a, error: aErr } = await supabase.from("profiles").select("id, role, nome_completo, professor_id, telefone").eq("id", user.id).single();
      if (!mounted) return;
      if (aErr || !a) { setErrMsg("Não foi possível carregar seu perfil."); setLoading(false); return; }
      if ((a.role || "").toLowerCase() !== "aluno") { router.replace("/dashboard"); return; }

      setAluno(a as any);

      if (!a.professor_id) {
        setErrMsg("Você ainda não está vinculado a um professor.");
        setLoading(false);
        return;
      }

      const { data: p } = await supabase.from("profiles").select("id, nome_completo").eq("id", a.professor_id).single();
      if (!mounted) return;
      setProf((p as any) ?? null);

      const { data: asData } = await supabase
        .from("aluno_assinaturas").select("id, status, start_at, end_at, duration_days")
        .eq("aluno_id", user.id).order("end_at", { ascending: false }).limit(1).maybeSingle();
      if (mounted) setAssinatura((asData as any) || null);

      const { data: pl, error: plErr } = await supabase
        .from("professor_planos")
        .select("id, professor_id, duration_days, title, description, price_cents, payment_url, whatsapp, is_active")
        .eq("professor_id", a.professor_id).eq("is_active", true).order("duration_days", { ascending: true });
      if (!mounted) return;

      if (plErr) { setErrMsg("Não foi possível carregar os planos."); setLoading(false); return; }
      setPlanos(((pl as any) || []) as ProfessorPlano[]);
      setLoading(false);
    })();

    return () => { mounted = false; };
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-white/40 text-sm">Carregando…</p>
      </div>
    );
  }

  const acessoAtivo = assinatura?.status === "active" && (diasRestantes ?? 0) > 0;

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white px-4 py-8 pb-16">
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="flex items-center gap-2 text-sm text-white/40">
          <Link href="/aluno/dashboard" className="hover:text-white/70 transition-colors">Dashboard</Link>
          <span>/</span>
          <span className="text-white/60">Planos</span>
        </div>

        {/* Header */}
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
          <h1 className="text-2xl font-bold text-white">
            Planos com {profNome}
          </h1>
          <p className="mt-1 text-white/50 text-sm">
            Pague pelo link e envie o comprovante no WhatsApp para o professor ativar seu acesso.
          </p>

          {errMsg && (
            <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">{errMsg}</div>
          )}

          {acessoAtivo ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="font-semibold text-white text-sm">Seu acesso está ativo — {diasRestantes} dia(s) restantes.</p>
              <p className="text-white/50 text-sm mt-0.5">Você pode voltar ao dashboard e seguir com seus treinos.</p>
              <Link href="/aluno/dashboard"
                className="mt-3 inline-flex items-center justify-center rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-white/90 transition-colors">
                Ir para o Dashboard
              </Link>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4">
              <p className="font-semibold text-white text-sm">Como funciona</p>
              <ol className="mt-2 space-y-1 text-sm text-white/50 list-decimal list-inside">
                <li>Escolha um plano e clique em <b className="text-white/70">Pagar agora</b>.</li>
                <li>Após pagar, clique em <b className="text-white/70">Enviar comprovante no WhatsApp</b>.</li>
                <li>Seu professor valida e libera seu acesso.</li>
              </ol>
            </div>
          )}
        </div>

        {/* Planos */}
        <div className="grid gap-4 md:grid-cols-3">
          {planos.length === 0 ? (
            <div className="md:col-span-3 rounded-2xl border border-white/8 bg-white/[0.03] p-6 text-white/50">
              Nenhum plano ativo encontrado para este professor.
            </div>
          ) : (
            planos.map((pl) => {
              const label = `${pl.duration_days} dias`;
              const price = moneyBRLFromCents(pl.price_cents);
              const isRec = pl.id === recomendadoId;
              const msg = `Olá ${profNome}! Sou ${alunoNome} (Motion). Vou assinar o plano de ${label}. Segue meu comprovante:`;
              const waPlan = waLink(pl.whatsapp, msg);
              const payDisabled = !pl.payment_url;

              return (
                <div key={pl.id} className={`rounded-2xl border p-5 ${isRec ? "border-white/20 bg-white/[0.06]" : "border-white/8 bg-white/[0.03]"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-white/40">{label}</p>
                      <p className="mt-0.5 font-semibold text-white">{pl.title || `Plano ${label}`}</p>
                    </div>
                    {isRec && (
                      <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-xs text-white/70 shrink-0">
                        Popular
                      </span>
                    )}
                  </div>

                  <p className="mt-3 text-2xl font-bold text-white">{price}</p>

                  <p className="mt-2 text-sm text-white/50 whitespace-pre-wrap">
                    {pl.description || `Acesso completo por ${label}.`}
                  </p>

                  <div className="mt-5 flex flex-col gap-2">
                    <a href={pl.payment_url || "#"} target="_blank" rel="noreferrer"
                      aria-disabled={payDisabled}
                      className={`rounded-xl px-4 py-3 text-sm font-semibold text-center transition-colors ${
                        payDisabled
                          ? "bg-white/5 text-white/30 border border-white/10 cursor-not-allowed"
                          : "bg-white text-black hover:bg-white/90"
                      }`}
                      onClick={(e) => { if (payDisabled) e.preventDefault(); }}>
                      Pagar agora
                    </a>

                    <a href={waPlan || "#"} target="_blank" rel="noreferrer"
                      className={`rounded-xl border px-4 py-3 text-sm font-medium text-center transition-colors ${
                        waPlan
                          ? "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                          : "border-white/10 bg-white/5 text-white/30 cursor-not-allowed"
                      }`}
                      onClick={(e) => { if (!waPlan) e.preventDefault(); }}>
                      Enviar comprovante no WhatsApp
                    </a>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {waGeral && (
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-white/50">
            Já pagou?{" "}
            <a href={waGeral} target="_blank" rel="noreferrer" className="text-white/70 underline hover:text-white transition-colors">
              Fale com o professor no WhatsApp
            </a>
          </div>
        )}

        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5 text-sm text-white/50">
          <p className="font-medium text-white/70">Transparência</p>
          <p className="mt-1">A liberação do acesso depende da validação do professor. Se você já enviou o comprovante, aguarde alguns minutos ou chame no WhatsApp.</p>
        </div>
      </div>
    </main>
  );
}
