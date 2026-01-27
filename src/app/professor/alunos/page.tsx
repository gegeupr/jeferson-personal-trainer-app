"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase-browser";

type ProfileAluno = {
  id: string;
  nome_completo: string | null;
  email: string | null;
  telefone: string | null;
  role?: string | null;
  professor_id?: string | null;
  ativo?: boolean | null; // se existir no seu schema
  avatar_url?: string | null; // se existir no seu schema
};

type Assinatura = {
  aluno_id: string;
  status: string | null;
  next_payment_date?: string | null;
  last_payment_date?: string | null;
};

type UltimaConclusao = {
  aluno_id: string;
  concluido_em: string | null;
  rotina_nome?: string | null;
  treino_nome?: string | null;
};

function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}

function buildWhatsAppLink(rawPhone: string | null, fallbackMsg: string) {
  const digits = onlyDigits(rawPhone || "");
  if (!digits) return null;

  // Se vier sem DDI, assumimos Brasil (55)
  const phone = digits.startsWith("55") ? digits : `55${digits}`;
  const text = encodeURIComponent(fallbackMsg);
  return `https://wa.me/${phone}?text=${text}`;
}

function badgeClass(kind: "ok" | "warn" | "bad" | "neutral") {
  switch (kind) {
    case "ok":
      return "bg-lime-400/15 text-lime-300 border border-lime-400/25";
    case "warn":
      return "bg-yellow-400/15 text-yellow-300 border border-yellow-400/25";
    case "bad":
      return "bg-red-400/15 text-red-300 border border-red-400/25";
    default:
      return "bg-white/5 text-white/70 border border-white/10";
  }
}

function assinaturaKind(status?: string | null) {
  const s = (status || "").toLowerCase();
  if (!s) return { label: "Sem assinatura", kind: "neutral" as const };
  if (s === "active" || s === "ativo") return { label: "Em dia", kind: "ok" as const };
  if (s === "pending" || s === "pendente") return { label: "Pendente", kind: "warn" as const };
  if (s === "canceled" || s === "cancelled" || s === "inativo") return { label: "Cancelado", kind: "bad" as const };
  return { label: status || "Status", kind: "neutral" as const };
}

function formatDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function ProfessorAlunosCRMPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadingExtra, setLoadingExtra] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profId, setProfId] = useState<string | null>(null);
  const [profSlug, setProfSlug] = useState<string | null>(null);

  const [alunos, setAlunos] = useState<ProfileAluno[]>([]);
  const [assinaturas, setAssinaturas] = useState<Record<string, Assinatura>>({});
  const [ultimas, setUltimas] = useState<Record<string, UltimaConclusao>>({});

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<
    "todos" | "ativos" | "inativos" | "sem_treino" | "sem_anamnese" | "assinatura_pendente"
  >("todos");

  // --------- Guard: só professor ----------
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      const { data: auth, error: authError } = await supabase.auth.getUser();
      const user = auth?.user;

      if (authError || !user) {
        router.push("/login");
        return;
      }

      // Pega perfil do professor (role e slug)
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("id, role, slug")
        .eq("id", user.id)
        .single();

      if (profErr || !prof) {
        setError("Não foi possível carregar seu perfil de professor.");
        setLoading(false);
        return;
      }

      if ((prof.role || "").toLowerCase() !== "professor") {
        router.push("/dashboard");
        return;
      }

      setProfId(prof.id);
      setProfSlug(prof.slug || null);

      setLoading(false);
    })();
  }, [router]);

  // --------- Carrega alunos ----------
  useEffect(() => {
    if (!profId) return;

    (async () => {
      setLoadingExtra(true);
      setError(null);

      const { data, error: err } = await supabase
        .from("profiles")
        .select("id, nome_completo, email, telefone, ativo, avatar_url, professor_id, role")
        .eq("professor_id", profId)
        .eq("role", "aluno")
        .order("created_at", { ascending: false });

      if (err) {
        setError(err.message);
        setLoadingExtra(false);
        return;
      }

      setAlunos((data || []) as ProfileAluno[]);
      setLoadingExtra(false);
    })();
  }, [profId]);

  // --------- Carrega extras (assinaturas + última conclusão) ----------
  useEffect(() => {
    if (!alunos.length) return;

    (async () => {
      try {
        setLoadingExtra(true);

        const ids = alunos.map((a) => a.id);

        const { data: asData } = await supabase
          .from("assinaturas")
          .select("aluno_id, status, next_payment_date, last_payment_date")
          .in("aluno_id", ids);

        const asMap: Record<string, Assinatura> = {};
        (asData || []).forEach((a: any) => {
          asMap[a.aluno_id] = a;
        });
        setAssinaturas(asMap);

        const { data: cData, error: cErr } = await supabase
          .from("aluno_rotina_conclusoes")
          .select("aluno_id, concluido_em, rotinas_diarias(nome), treinos(nome)")
          .in("aluno_id", ids)
          .order("concluido_em", { ascending: false })
          .limit(300);

        if (!cErr && cData) {
          const uMap: Record<string, UltimaConclusao> = {};
          for (const row of cData as any[]) {
            if (!uMap[row.aluno_id]) {
              uMap[row.aluno_id] = {
                aluno_id: row.aluno_id,
                concluido_em: row.concluido_em || null,
                rotina_nome: row.rotinas_diarias?.nome || null,
                treino_nome: row.treinos?.nome || null,
              };
            }
          }
          setUltimas(uMap);
        }

        setLoadingExtra(false);
      } catch {
        setLoadingExtra(false);
      }
    })();
  }, [alunos]);

  // --------- filtros ----------
  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();

    const base = alunos.filter((a) => {
      const name = (a.nome_completo || "").toLowerCase();
      const em = (a.email || "").toLowerCase();
      const tel = (a.telefone || "").toLowerCase();
      if (!qq) return true;
      return name.includes(qq) || em.includes(qq) || tel.includes(qq);
    });

    const byFilter = base.filter((a) => {
      if (filter === "todos") return true;

      const isAtivo = a.ativo === null || a.ativo === undefined ? true : !!a.ativo;

      if (filter === "ativos") return isAtivo;
      if (filter === "inativos") return !isAtivo;

      if (filter === "assinatura_pendente") {
        const s = (assinaturas[a.id]?.status || "").toLowerCase();
        return s === "pending" || s === "pendente";
      }

      if (filter === "sem_treino") {
        return !ultimas[a.id]?.concluido_em;
      }

      if (filter === "sem_anamnese") {
        return false;
      }

      return true;
    });

    return byFilter;
  }, [alunos, q, filter, assinaturas, ultimas]);

  const total = alunos.length;
  const ativosCount = alunos.filter((a) => (a.ativo === null || a.ativo === undefined ? true : !!a.ativo)).length;
  const inativosCount = total - ativosCount;
  const pendentesCount = alunos.filter((a) => {
    const s = (assinaturas[a.id]?.status || "").toLowerCase();
    return s === "pending" || s === "pendente";
  }).length;

  const inviteLink = profSlug ? `/p/${profSlug}` : "/professor/perfil-publico";

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-lime-300 text-lg">Carregando Motion…</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-xl w-full rounded-2xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-xl font-semibold text-red-300">Erro</h1>
          <p className="mt-2 text-white/70">{error}</p>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => location.reload()}
              className="rounded-xl bg-lime-500 px-4 py-2 text-black font-semibold hover:bg-lime-400 transition"
            >
              Recarregar
            </button>
            <Link
              href="/professor/dashboard"
              className="rounded-xl border border-white/15 px-4 py-2 text-white/80 hover:bg-white/5 transition"
            >
              Voltar ao dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* TOP BAR (com botão voltar) */}
      <div className="sticky top-0 z-50 border-b border-white/10 bg-black/60 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/professor/dashboard"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
            >
              ← Voltar ao Dashboard
            </Link>

            <div className="hidden sm:block">
              <p className="text-sm text-white/70">Motion</p>
              <h1 className="text-lg font-semibold">Gestão de Alunos</h1>
            </div>
          </div>

          <Link
            href="/professor/perfil-publico"
            className="rounded-full bg-lime-500 px-4 py-2 text-sm font-semibold text-black hover:bg-lime-400 transition"
          >
            Meu Perfil Público
          </Link>
        </div>
      </div>

      {/* Header */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-10 pb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Meus <span className="text-lime-300">Alunos</span>
            </h1>
            <p className="mt-2 text-white/60">
              Gestão premium do Motion: encontre rápido, acione rápido, acompanhe melhor.
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href={inviteLink}
              className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-white/80 hover:bg-white/10 transition"
            >
              Link público / convite
            </Link>

            <Link
              href="/professor/perfil-publico"
              className="rounded-2xl bg-lime-500 px-4 py-2 text-black font-semibold hover:bg-lime-400 transition"
            >
              Ajustar perfil público
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <div className="relative">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nome, email ou telefone…"
                className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 pr-10 text-white placeholder-white/30 outline-none focus:border-lime-400/40 focus:ring-2 focus:ring-lime-400/10 transition"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40">⌕</span>
            </div>
          </div>

          <div className="text-sm text-white/50">
            {loadingExtra ? "Atualizando indicadores…" : `${filtered.length} / ${total} alunos`}
          </div>
        </div>

        {/* Quick filters */}
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={() => setFilter("todos")}
            className={`rounded-full px-3 py-1.5 text-sm border transition ${
              filter === "todos"
                ? "border-lime-400/40 bg-lime-400/10 text-lime-200"
                : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            Todos <span className="ml-1 text-white/40">{total}</span>
          </button>

          <button
            onClick={() => setFilter("ativos")}
            className={`rounded-full px-3 py-1.5 text-sm border transition ${
              filter === "ativos"
                ? "border-lime-400/40 bg-lime-400/10 text-lime-200"
                : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            Ativos <span className="ml-1 text-white/40">{ativosCount}</span>
          </button>

          <button
            onClick={() => setFilter("inativos")}
            className={`rounded-full px-3 py-1.5 text-sm border transition ${
              filter === "inativos"
                ? "border-lime-400/40 bg-lime-400/10 text-lime-200"
                : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            Inativos <span className="ml-1 text-white/40">{inativosCount}</span>
          </button>

          <button
            onClick={() => setFilter("assinatura_pendente")}
            className={`rounded-full px-3 py-1.5 text-sm border transition ${
              filter === "assinatura_pendente"
                ? "border-yellow-400/40 bg-yellow-400/10 text-yellow-200"
                : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            Assinatura pendente <span className="ml-1 text-white/40">{pendentesCount}</span>
          </button>

          <button
            onClick={() => setFilter("sem_treino")}
            className={`rounded-full px-3 py-1.5 text-sm border transition ${
              filter === "sem_treino"
                ? "border-white/25 bg-white/10 text-white"
                : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            }`}
            title="Heurística: aparece quem não tem conclusão registrada."
          >
            Sem treino (proxy)
          </button>
        </div>
      </div>

      {/* List */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-14">
        {filtered.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
            <p className="text-white/70">Nenhum aluno encontrado com esse filtro/busca.</p>
            <p className="mt-2 text-sm text-white/40">
              Dica: use o link público para captar alunos e trazer cadastros automaticamente.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((a) => {
              const assinatura = assinaturas[a.id];
              const badge = assinaturaKind(assinatura?.status);

              const last = ultimas[a.id];
              const lastTxt = last?.concluido_em
                ? `Último treino: ${formatDateTime(last.concluido_em)}`
                : "Sem conclusão registrada";

              const isAtivo = a.ativo === null || a.ativo === undefined ? true : !!a.ativo;

              const wa = buildWhatsAppLink(
                a.telefone,
                `Olá ${a.nome_completo || ""}! Aqui é o seu professor no Motion. Como foi seu dia de treino?`
              );

              return (
                <div
                  key={a.id}
                  className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-5 hover:bg-white/7 transition"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    {/* Left */}
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="relative h-12 w-12 rounded-2xl overflow-hidden border border-white/10 bg-black/40 shrink-0">
                        {a.avatar_url ? (
                          <Image src={a.avatar_url} alt="Avatar" fill className="object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-lime-300 font-extrabold">
                            {(a.nome_completo || "M").slice(0, 1).toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-white truncate max-w-[520px]">
                            {a.nome_completo || "Aluno"}
                          </p>

                          <span className={`text-xs px-2 py-1 rounded-full ${badgeClass(badge.kind)}`}>
                            {badge.label}
                          </span>

                          <span className={`text-xs px-2 py-1 rounded-full ${badgeClass(isAtivo ? "ok" : "bad")}`}>
                            {isAtivo ? "Ativo" : "Inativo"}
                          </span>
                        </div>

                        <div className="mt-1 text-sm text-white/55 truncate">
                          {a.email || "—"}{" "}
                          {a.telefone ? <span className="text-white/35">• {a.telefone}</span> : null}
                        </div>

                        <div className="mt-1 text-xs text-white/40">{lastTxt}</div>
                      </div>
                    </div>

                    {/* Right actions */}
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      <Link
                        href={`/professor/alunos/${a.id}/detalhes`}
                        className="rounded-2xl bg-lime-500 px-3 py-2 text-sm font-semibold text-black hover:bg-lime-400 transition"
                      >
                        Ver aluno
                      </Link>

                      <Link
                        href={`/professor/alunos/${a.id}/atribuir-treino`}
                        className="rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10 transition"
                      >
                        Atribuir treino
                      </Link>

                      <Link
                        href={`/professor/alunos/${a.id}/progresso-aluno`}
                        className="rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10 transition"
                      >
                        Progresso
                      </Link>

                      <Link
                        href={`/professor/alunos/${a.id}/arquivos`}
                        className="rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10 transition"
                      >
                        Arquivos
                      </Link>

                      <Link
                        href={`/professor/alunos/${a.id}/financeiro`}
                        className="rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10 transition"
                      >
                        Financeiro
                      </Link>

                      {wa ? (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-2xl border border-lime-400/20 bg-lime-400/10 px-3 py-2 text-sm text-lime-200 hover:bg-lime-400/15 transition"
                        >
                          WhatsApp
                        </a>
                      ) : (
                        <span
                          className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/30"
                          title="Sem telefone cadastrado"
                        >
                          WhatsApp
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Secondary quick links row */}
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <Link
                      href={`/professor/alunos/${a.id}/anamnese`}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/60 hover:bg-white/10 transition"
                    >
                      Anamnese
                    </Link>
                    <Link
                      href={`/professor/alunos/${a.id}/treinos-extras`}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/60 hover:bg-white/10 transition"
                    >
                      Treinos extras
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}