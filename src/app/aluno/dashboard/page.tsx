"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/utils/supabase-browser";

const WELCOME_PENDING_KEY = "motion_welcome_pending";

// quantos dias antes avisar “vencendo”
const WARN_DAYS = 5;

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
  slug: string | null;
  avatar_url: string | null;
  cover_url: string | null;
};

// ✅ NOVO MODELO (tabela aluno_assinaturas)
type AssinaturaLite = {
  status: "active" | "expired" | "canceled" | null;
  end_at: string | null;
};

type SubUI =
  | { state: "loading"; label: string; desc: string; pill: string; pillClass: string }
  | { state: "active"; label: string; desc: string; pill: string; pillClass: string; daysLeft: number | null }
  | { state: "expiring"; label: string; desc: string; pill: string; pillClass: string; daysLeft: number }
  | { state: "expired"; label: string; desc: string; pill: string; pillClass: string; daysLeft: number | null }
  | { state: "inactive"; label: string; desc: string; pill: string; pillClass: string; daysLeft: null };

function daysUntil(iso: string) {
  const end = new Date(iso).getTime();
  const now = Date.now();
  const diff = end - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function Icon({
  name,
}: {
  name: "dumbbell" | "form" | "bolt" | "camera" | "file" | "user" | "credit";
}) {
  if (name === "dumbbell")
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 7v10" />
        <path d="M18 7v10" />
        <path d="M3 9v6" />
        <path d="M21 9v6" />
        <path d="M6 12h12" />
      </svg>
    );

  if (name === "form")
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 11h6" />
        <path d="M9 15h6" />
        <path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      </svg>
    );

  if (name === "bolt")
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
      </svg>
    );

  if (name === "camera")
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    );

  if (name === "file")
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
      </svg>
    );

  if (name === "credit")
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
        <path d="M6 15h4" />
      </svg>
    );

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function Card({
  href,
  title,
  desc,
  icon,
  tag,
  tagClass,
}: {
  href: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
  tag?: string;
  tagClass?: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-3xl border border-white/10 bg-white/5 p-6 hover:bg-white/10 transition shadow-[0_10px_30px_rgba(0,0,0,.35)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl border border-white/10 bg-black/30 flex items-center justify-center text-lime-300">
            {icon}
          </div>
          <div>
            <p className="text-lg font-bold text-white">{title}</p>
            {tag ? <p className={`text-xs mt-0.5 ${tagClass ?? "text-lime-300/90"}`}>{tag}</p> : null}
          </div>
        </div>
        <span className="text-white/40 group-hover:text-white/70 transition">↗</span>
      </div>
      <p className="mt-3 text-sm text-white/60">{desc}</p>
    </Link>
  );
}

// ✅ NOVA lógica usando aluno_assinaturas (active/expired/canceled + end_at)
function subToUI(sub: AssinaturaLite | null): SubUI {
  if (!sub) {
    return {
      state: "inactive",
      label: "Assinatura",
      desc: "Sem assinatura ativa. Escolha um plano e fale com seu professor.",
      pill: "Inativa",
      pillClass: "text-red-200",
      daysLeft: null,
    };
  }

  const st = sub.status ?? "expired";
  const fim = sub.end_at;

  if (!fim) {
    return {
      state: "inactive",
      label: "Assinatura",
      desc: "Assinatura sem data de expiração. Fale com seu professor para ajustar.",
      pill: "Inativa",
      pillClass: "text-red-200",
      daysLeft: null,
    };
  }

  const d = daysUntil(fim);

  // Expira por data (mesmo que status esteja active por algum motivo)
  if (d <= 0 || st === "expired") {
    return {
      state: "expired",
      label: "Assinatura",
      desc: "Seu acesso venceu. Renove para continuar usando o Motion.",
      pill: "Vencida",
      pillClass: "text-red-200",
      daysLeft: d,
    };
  }

  if (st === "canceled") {
    return {
      state: "inactive",
      label: "Assinatura",
      desc: "Assinatura cancelada. Fale com seu professor para reativar.",
      pill: "Cancelada",
      pillClass: "text-red-200",
      daysLeft: null,
    };
  }

  // Active
  if (d <= WARN_DAYS) {
    return {
      state: "expiring",
      label: "Assinatura",
      desc: `Seu acesso vence em ${d} dia(s). Já se programe para renovar.`,
      pill: `Vencendo (${d}d)`,
      pillClass: "text-yellow-200",
      daysLeft: d,
    };
  }

  return {
    state: "active",
    label: "Assinatura",
    desc: `Acesso ativo. Validade: ${new Date(fim).toLocaleDateString("pt-BR")}.`,
    pill: `Ativa (${d}d)`,
    pillClass: "text-lime-200",
    daysLeft: d,
  };
}

export default function AlunoDashboardPremium() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState<string | null>(null);

  const [aluno, setAluno] = useState<ProfileAluno | null>(null);
  const [professor, setProfessor] = useState<ProfileProfessor | null>(null);

  const [assinatura, setAssinatura] = useState<AssinaturaLite | null>(null);

  const alunoNome = useMemo(() => aluno?.nome_completo || "Aluno", [aluno?.nome_completo]);
  const profNome = useMemo(() => professor?.nome_completo || "Professor", [professor?.nome_completo]);

  const subUI = useMemo(() => subToUI(assinatura), [assinatura]);

  useEffect(() => {
    let mounted = true;

    async function boot() {
      setLoading(true);
      setFatalError(null);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, nome_completo, telefone, role, professor_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        console.error("Erro ao buscar profile:", profileError?.message);
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }

      if (profile.role !== "aluno") {
        router.replace("/dashboard");
        return;
      }

      // ✅ Gate da Boas-Vindas
      const pending = localStorage.getItem(WELCOME_PENDING_KEY);
      if (pending === "1") {
        router.replace("/aluno/bem-vindo");
        return;
      }

      if (!mounted) return;
      setAluno(profile as any);

      // ✅ Carrega assinatura mais recente do aluno (TABELA NOVA)
      const { data: ass, error: assErr } = await supabase
        .from("aluno_assinaturas")
        .select("status, end_at")
        .eq("aluno_id", user.id)
        .order("end_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!mounted) return;

      if (assErr) {
        console.warn("Não consegui ler aluno_assinaturas:", assErr.message);
        setAssinatura(null);
      } else {
        setAssinatura((ass as any) || null);
      }

      // ✅ BLOQUEIO AUTOMÁTICO (agora baseado na tabela nova)
      const ui = subToUI((ass as any) || null);
      if (ui.state === "expired" || ui.state === "inactive") {
        router.replace("/aluno/planos");
        return;
      }

      // Professor vinculado
      if (profile.professor_id) {
        const { data: prof, error: profError } = await supabase
          .from("profiles")
          .select("id, nome_completo, slug, avatar_url, cover_url")
          .eq("id", profile.professor_id)
          .single();

        if (profError) {
          console.warn("Erro ao carregar professor:", profError.message);
        } else if (mounted) {
          setProfessor((prof as any) || null);
        }
      } else {
        setProfessor(null);
      }

      if (!mounted) return;
      setLoading(false);
    }

    boot();

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/login");
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center text-lime-300 text-xl">
        Carregando Motion…
      </main>
    );
  }

  if (fatalError) {
    return (
      <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-red-200 p-6">
        <p className="max-w-md text-center">{fatalError}</p>
        <button
          onClick={() => router.replace("/login")}
          className="mt-4 rounded-2xl bg-lime-400 px-5 py-3 font-bold text-black"
        >
          Voltar
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
        {/* Top bar */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-white/60 text-sm">Dashboard do aluno</p>
            <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-tight">
              Olá, <span className="text-lime-300">{alunoNome}</span>
            </h1>
            <p className="mt-2 text-white/60 text-sm">Treinos, evolução e arquivos — tudo organizado no Motion.</p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/aluno/perfil"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
            >
              Meu perfil
            </Link>
            <button
              onClick={handleLogout}
              className="rounded-2xl bg-lime-400 px-4 py-2 text-sm font-bold text-black hover:bg-lime-300"
            >
              Sair
            </button>
          </div>
        </div>

        {/* Hero Professor */}
        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 overflow-hidden shadow-2xl backdrop-blur">
          <div className="relative h-52 w-full bg-black/40">
            {professor?.cover_url ? (
              <Image src={professor.cover_url} alt="Capa do professor" fill className="object-cover opacity-80" priority />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/40 to-black/90" />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/40 to-black/90" />

            <div className="absolute left-6 bottom-[-30px] flex items-end gap-3">
              <div className="relative h-20 w-20 rounded-2xl overflow-hidden border border-white/10 bg-black/40">
                {professor?.avatar_url ? (
                  <Image src={professor.avatar_url} alt="Avatar" fill className="object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-lime-300 font-extrabold text-2xl">
                    {(profNome.slice(0, 1) || "M").toUpperCase()}
                  </div>
                )}
              </div>

              <div className="pb-2">
                <p className="text-xs text-white/60">Seu professor</p>
                <p className="text-lg font-bold">
                  {professor ? (
                    <>
                      Prof. <span className="text-lime-300">{profNome}</span>
                    </>
                  ) : (
                    <span className="text-red-200">Nenhum professor vinculado</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="pt-12 px-6 pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="text-sm text-white/60">
              <span>
                <b className={`font-bold ${subUI.pillClass}`}>{subUI.pill}</b> — {subUI.desc}
              </span>
            </div>

            <div className="flex gap-2">
              {professor?.slug ? (
                <Link
                  href={`/p/${professor.slug}`}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
                >
                  Ver página do professor
                </Link>
              ) : null}

              <Link
                href="/aluno/treinos"
                className="rounded-2xl bg-lime-400 px-4 py-2 text-sm font-bold text-black hover:bg-lime-300"
              >
                Abrir meus treinos
              </Link>
            </div>
          </div>
        </div>

        {/* Cards */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* ✅ Card PREMIUM */}
          <Card
            href="/aluno/planos"
            title="Assinatura & Planos"
            desc={subUI.desc}
            icon={<Icon name="credit" />}
            tag={subUI.pill}
            tagClass={subUI.pillClass}
          />

          <Card
            href="/aluno/treinos"
            title="Meus Treinos"
            desc="Plano principal e rotinas do dia"
            icon={<Icon name="dumbbell" />}
            tag="Treino principal"
          />

          <Card
            href="/aluno/anamnese"
            title="Anamnese"
            desc="Saúde, objetivos e histórico"
            icon={<Icon name="form" />}
            tag="Importante"
          />

          <Card
            href="/aluno/treinos-extras"
            title="Treinos Extras"
            desc="Complementares e condicionamento"
            icon={<Icon name="bolt" />}
            tag="Bônus"
          />

          <Card
            href="/aluno/progresso"
            title="Progresso"
            desc="Fotos e evolução no tempo"
            icon={<Icon name="camera" />}
          />

          <Card
            href="/aluno/arquivos"
            title="Arquivos"
            desc="Exames, PDFs e documentos"
            icon={<Icon name="file" />}
          />

          <Card
            href="/aluno/perfil"
            title="Meu Perfil"
            desc="Conta, dados e preferências"
            icon={<Icon name="user" />}
          />
        </div>

        <div className="mt-10 text-center text-xs text-white/40">Motion — treino inteligente, gestão simples.</div>
      </div>
    </main>
  );
}