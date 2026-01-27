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

function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}

function waLink(phoneRaw: string | null | undefined, msg: string) {
  const digits = onlyDigits(phoneRaw || "");
  if (!digits) return null;
  const full = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${full}?text=${encodeURIComponent(msg)}`;
}

function moneyBRLFromCents(cents?: number | null) {
  if (cents === null || cents === undefined) return "Consulte";
  const v = cents / 100;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function daysLeft(endAt?: string | null) {
  if (!endAt) return null;
  const end = new Date(endAt).getTime();
  const now = Date.now();
  const diff = end - now;
  return Math.floor(diff / 86400000);
}

function Pill({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
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
    if (!assinatura) return null;
    if (assinatura.status !== "active") return null;
    return daysLeft(assinatura.end_at);
  }, [assinatura]);

  const recomendadoId = useMemo(() => {
    // recomenda 90 dias se existir; senão null
    return planos.find((p) => p.duration_days === 90)?.id ?? null;
  }, [planos]);

  const waGeral = useMemo(() => {
    const wpp = planos[0]?.whatsapp; // todos deveriam ser o mesmo do professor
    if (!wpp) return null;
    return waLink(
      wpp,
      `Olá ${profNome}! Eu sou ${alunoNome} (Motion). Acabei de realizar o pagamento e vou enviar o comprovante aqui.`
    );
  }, [planos, profNome, alunoNome]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setErrMsg(null);

      const { data: auth, error: authError } = await supabase.auth.getUser();
      const user = auth?.user;

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      // Perfil do aluno
      const { data: a, error: aErr } = await supabase
        .from("profiles")
        .select("id, role, nome_completo, professor_id, telefone")
        .eq("id", user.id)
        .single();

      if (!mounted) return;

      if (aErr || !a) {
        setErrMsg("Não foi possível carregar seu perfil.");
        setLoading(false);
        return;
      }

      if ((a.role || "").toLowerCase() !== "aluno") {
        router.replace("/dashboard");
        return;
      }

      setAluno(a as any);

      if (!a.professor_id) {
        setErrMsg("Você ainda não está vinculado a um professor. Peça o link “Treinar comigo”.");
        setLoading(false);
        return;
      }

      // Professor (nome)
      const { data: p, error: pErr } = await supabase
        .from("profiles")
        .select("id, nome_completo")
        .eq("id", a.professor_id)
        .single();

      if (!mounted) return;

      if (pErr || !p) {
        setErrMsg("Não foi possível carregar os dados do professor.");
        setLoading(false);
        return;
      }

      setProf(p as any);

      // Assinatura mais recente (para banner e botão "ir pro dashboard")
      const { data: asData } = await supabase
        .from("aluno_assinaturas")
        .select("id, status, start_at, end_at, duration_days")
        .eq("aluno_id", user.id)
        .order("end_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (mounted) setAssinatura((asData as any) || null);

      // Planos do professor (tabela nova)
      const { data: pl, error: plErr } = await supabase
        .from("professor_planos")
        .select("id, professor_id, duration_days, title, description, price_cents, payment_url, whatsapp, is_active")
        .eq("professor_id", a.professor_id)
        .eq("is_active", true)
        .order("duration_days", { ascending: true });

      if (!mounted) return;

      if (plErr) {
        setErrMsg("Não foi possível carregar os planos do professor.");
        setPlanos([]);
        setLoading(false);
        return;
      }

      setPlanos(((pl as any) || []) as ProfessorPlano[]);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-lime-300 text-lg">Carregando…</div>
      </main>
    );
  }

  const acessoAtivo = assinatura?.status === "active" && (diasRestantes ?? 0) > 0;

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* TOP BAR */}
      <div className="sticky top-0 z-50 border-b border-white/10 bg-black/60 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <Link
            href="/aluno/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
          >
            ← Voltar ao Dashboard
          </Link>

          {acessoAtivo ? (
            <Pill className="text-lime-200">Acesso ativo • {diasRestantes} dia(s) restantes</Pill>
          ) : (
            <Pill className="text-yellow-200">Aguardando ativação</Pill>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 pb-16 space-y-4">
        {/* Header premium */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Seus planos com <span className="text-lime-300">{profNome}</span>
          </h1>

          <p className="mt-2 text-white/60 text-sm">
            Pague pelo link do professor e envie o comprovante no WhatsApp para ele ativar seu acesso.
          </p>

          {errMsg ? (
            <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">
              {errMsg}
            </div>
          ) : null}

          {/* Banner inteligente */}
          {acessoAtivo ? (
            <div className="mt-5 rounded-2xl border border-lime-400/20 bg-lime-400/10 p-4">
              <p className="text-lime-200 font-semibold">{alunoNome}, seu acesso já está ativo.</p>
              <p className="text-white/70 text-sm mt-1">
                Você pode voltar ao dashboard e seguir com seus treinos.
              </p>
              <div className="mt-3">
                <Link
                  href="/aluno/dashboard"
                  className="inline-flex items-center justify-center rounded-2xl bg-lime-400 px-5 py-2.5 text-sm font-extrabold text-black hover:bg-lime-300"
                >
                  Ir para o Dashboard
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-white/80 font-semibold">Como funciona</p>
              <ol className="mt-2 space-y-1 text-sm text-white/60 list-decimal list-inside">
                <li>Escolha um plano e clique em <b>Pagar agora</b>.</li>
                <li>Após pagar, clique em <b>Enviar comprovante no WhatsApp</b>.</li>
                <li>Seu professor valida e libera seu acesso.</li>
              </ol>
            </div>
          )}
        </div>

        {/* Planos */}
        <div className="grid gap-4 md:grid-cols-3">
          {planos.length === 0 ? (
            <div className="md:col-span-3 rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70">
              Nenhum plano ativo foi encontrado para este professor.
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
                <div
                  key={pl.id}
                  className={`rounded-3xl border p-5 shadow-[0_10px_30px_rgba(0,0,0,.35)] ${
                    isRec
                      ? "border-lime-400/40 ring-1 ring-lime-400/20 bg-white/5"
                      : "border-white/10 bg-black/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-white/50">{label}</p>
                      <p className="mt-1 text-lg font-extrabold">{pl.title || `Plano ${label}`}</p>
                    </div>
                    {isRec ? (
                      <Pill className="text-lime-200 border-lime-400/30 bg-lime-400/10">
                        Recomendado
                      </Pill>
                    ) : (
                      <Pill className="text-white/70">Plano</Pill>
                    )}
                  </div>

                  <p className="mt-3 text-lime-300 font-extrabold text-2xl">{price}</p>

                  <p className="mt-3 text-sm text-white/65 whitespace-pre-wrap">
                    {pl.description || `Acesso completo por ${label}.`}
                  </p>

                  <div className="mt-5 flex flex-col gap-2">
                    <a
                      href={pl.payment_url || "#"}
                      target="_blank"
                      rel="noreferrer"
                      aria-disabled={payDisabled}
                      className={`rounded-2xl px-4 py-3 text-sm font-extrabold transition text-center ${
                        payDisabled
                          ? "bg-white/5 text-white/40 border border-white/10 cursor-not-allowed"
                          : "bg-lime-500 text-black hover:bg-lime-400"
                      }`}
                      onClick={(e) => {
                        if (payDisabled) e.preventDefault();
                      }}
                    >
                      Pagar agora
                    </a>

                    <a
                      href={waPlan || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition text-center ${
                        waPlan
                          ? "border-lime-400/20 bg-lime-400/10 text-lime-200 hover:bg-lime-400/15"
                          : "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                      }`}
                      onClick={(e) => {
                        if (!waPlan) e.preventDefault();
                      }}
                    >
                      Enviar comprovante no WhatsApp
                    </a>

                    {!pl.whatsapp ? (
                      <div className="text-xs text-white/40 text-center pt-1">
                        WhatsApp do professor não configurado.
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Dica geral */}
        {waGeral ? (
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/70">
            Dica: se você pagou e quer falar direto com o professor:
            <a className="ml-2 text-lime-300 underline" href={waGeral} target="_blank" rel="noreferrer">
              abrir WhatsApp
            </a>
          </div>
        ) : null}

        {/* Rodapé confiança */}
        <div className="rounded-3xl border border-white/10 bg-black/30 p-6 text-sm text-white/60">
          <p className="font-semibold text-white/80">Transparência</p>
          <p className="mt-2">
            A liberação do acesso depende da validação do professor. Se você já enviou o comprovante,
            aguarde alguns minutos ou chame no WhatsApp.
          </p>
        </div>
      </div>
    </main>
  );
}