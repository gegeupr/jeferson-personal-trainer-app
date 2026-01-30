"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/utils/supabase-browser";

type ProfProfile = {
  id: string;
  role: "professor" | "aluno";
  nome_completo: string | null;
  telefone: string | null;
  avatar_url?: string | null;
  cover_url?: string | null;
  slug?: string | null;
};

type Aluno = {
  id: string;
  nome_completo: string | null;
  email?: string | null;
  telefone: string | null;
  avatar_url?: string | null;
};

type ConclusaoFeed = {
  id: string;
  concluido_em: string;
  feedback_nota: number | null;
  feedback_texto: string | null;
  aluno_id: string;
  treino_id: string;
  rotina_id: string;
  aluno?: {
    id: string;
    nome_completo: string | null;
    telefone: string | null;
    avatar_url?: string | null;
  } | null;
  treino?: { id: string; nome: string | null } | null;
  rotina?: { id: string; nome: string | null } | null;
};

type AssinaturaStatus = "pending" | "active" | "expired" | "canceled";
type Assinatura = {
  id: string;
  professor_id: string;
  aluno_id: string;
  plano_id: string | null;
  duration_days: 30 | 90 | 180;
  status: AssinaturaStatus;
  start_at: string | null;
  end_at: string | null;
  note: string | null;
  activated_by: string | null;
  created_at: string;
  updated_at: string;
};

// Lista “pendente” já enriquecida com aluno
type PendingItem = Assinatura & {
  aluno?: { id: string; nome_completo: string | null; telefone: string | null; avatar_url?: string | null } | null;
};

function onlyDigits(s: string) {
  return (s || "").replace(/\D/g, "");
}

function waLink(phoneBR: string, msg: string) {
  const phone = onlyDigits(phoneBR);
  if (!phone) return null;
  const full = phone.startsWith("55") ? phone : `55${phone}`;
  return `https://wa.me/${full}?text=${encodeURIComponent(msg)}`;
}

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-white/70 text-xs">
      {children}
    </span>
  );
}

function StatCard({ title, value, hint }: { title: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl">
      <p className="text-white/60 text-xs">{title}</p>
      <p className="mt-2 text-3xl font-extrabold text-white">{value}</p>
      {hint ? <p className="mt-2 text-white/50 text-xs">{hint}</p> : null}
    </div>
  );
}

export default function ProfessorDashboardPremium() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [prof, setProf] = useState<ProfProfile | null>(null);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [feed, setFeed] = useState<ConclusaoFeed[]>([]);

  const [treinosCount, setTreinosCount] = useState(0);
  const [alunosCount, setAlunosCount] = useState(0);
  const [concluidosCount, setConcluidosCount] = useState(0);

  // ✅ NOVO: pendências
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingBusyId, setPendingBusyId] = useState<string | null>(null);

  const profName = prof?.nome_completo || "Professor";
  const profSlug = prof?.slug || null;

  const publicLink = useMemo(() => {
    if (!profSlug) return null;
    if (typeof window === "undefined") return `/p/${profSlug}`;
    return `${window.location.origin}/p/${profSlug}`;
  }, [profSlug]);

  async function copyPublicLink() {
    if (!publicLink) return;
    try {
      await navigator.clipboard.writeText(publicLink);
      alert("Link do seu perfil público copiado!");
    } catch {
      alert("Não consegui copiar automaticamente. Copie manualmente:\n" + publicLink);
    }
  }

  // ✅ NOVO: carregar pendências e “enriquecer” com dados do aluno
  async function loadPendencias(profId: string) {
    const { data: pend, error: pendErr } = await supabase
      .from("aluno_assinaturas")
      .select("id, professor_id, aluno_id, plano_id, duration_days, status, start_at, end_at, note, activated_by, created_at, updated_at")
      .eq("professor_id", profId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(30);

    if (pendErr || !pend) {
      setPending([]);
      setPendingCount(0);
      return;
    }

    setPendingCount(pend.length);

    const alunoIds = [...new Set(pend.map((x: any) => x.aluno_id))].filter(Boolean);
    if (alunoIds.length === 0) {
      setPending(pend as any);
      return;
    }

    const { data: alunosMini } = await supabase
      .from("profiles")
      .select("id, nome_completo, telefone, avatar_url")
      .in("id", alunoIds);

    const alunosMap = new Map((alunosMini || []).map((a: any) => [a.id, a]));

    const pendFinal: PendingItem[] = (pend as any[]).map((x) => ({
      ...x,
      aluno: alunosMap.get(x.aluno_id) || null,
    }));

    setPending(pendFinal);
  }

  // ✅ NOVO: aprovar pendência (ativa assinatura)
  async function aprovarPendencia(p: PendingItem, profId: string) {
    setPendingBusyId(p.id);
    try {
      // 1) expira qualquer assinatura ativa atual do aluno
      const { error: closeErr } = await supabase
        .from("aluno_assinaturas")
        .update({ status: "expired" })
        .eq("aluno_id", p.aluno_id)
        .eq("status", "active");

      if (closeErr) throw closeErr;

      // 2) define período (start/end)
      const start = new Date();
      const end = new Date(start);
      end.setDate(end.getDate() + Number(p.duration_days));
      end.setHours(23, 59, 59, 999);

      // 3) atualiza a própria pendência -> active
      const { error: updErr } = await supabase
        .from("aluno_assinaturas")
        .update({
          status: "active",
          start_at: start.toISOString(),
          end_at: end.toISOString(),
          activated_by: profId,
          note: p.note || `Ativado manualmente: ${p.duration_days} dias`,
        })
        .eq("id", p.id)
        .eq("professor_id", profId);

      if (updErr) throw updErr;

      // recarrega pendências (some da lista)
      await loadPendencias(profId);
      alert(`Assinatura ativada: ${p.duration_days} dias.`);
    } catch (e: any) {
      alert(e?.message || "Erro ao aprovar pendência.");
    } finally {
      setPendingBusyId(null);
    }
  }

  // ✅ NOVO: cancelar pendência
  async function cancelarPendencia(p: PendingItem, profId: string) {
    setPendingBusyId(p.id);
    try {
      const { error } = await supabase
        .from("aluno_assinaturas")
        .update({ status: "canceled" })
        .eq("id", p.id)
        .eq("professor_id", profId);

      if (error) throw error;

      await loadPendencias(profId);
      alert("Pendência cancelada.");
    } catch (e: any) {
      alert(e?.message || "Erro ao cancelar pendência.");
    } finally {
      setPendingBusyId(null);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function boot() {
      setLoading(true);
      setErr(null);

      const { data: auth, error: authError } = await supabase.auth.getUser();
      const user = auth?.user;

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      // Perfil do professor
      const { data: myProf, error: pErr } = await supabase
        .from("profiles")
        .select("id, role, nome_completo, telefone, avatar_url, cover_url, slug")
        .eq("id", user.id)
        .single();

      if (!mounted) return;

      if (pErr || !myProf) {
        setErr("Não foi possível carregar seu perfil.");
        setLoading(false);
        return;
      }

      if (myProf.role !== "professor") {
        router.replace("/dashboard");
        return;
      }

      setProf(myProf as ProfProfile);

      // ✅ NOVO: carrega pendências
      await loadPendencias(user.id);

      // Alunos do professor
      const { data: alunosData, error: aErr } = await supabase
        .from("profiles")
        .select("id, nome_completo, telefone, avatar_url")
        .eq("professor_id", user.id)
        .eq("role", "aluno")
        .order("created_at", { ascending: false });

      if (!mounted) return;

      if (!aErr && alunosData) {
        setAlunos(alunosData as any);
        setAlunosCount(alunosData.length);
      } else {
        setAlunos([]);
        setAlunosCount(0);
      }

      // Quantidade de treinos atribuídos
      const { count: tCount } = await supabase
        .from("treinos")
        .select("id", { count: "exact", head: true })
        .eq("professor_id", user.id);

      setTreinosCount(tCount || 0);

      // Feed: últimas rotinas concluídas
      const { data: concl, error: cErr } = await supabase
        .from("aluno_rotina_conclusoes")
        .select("id, aluno_id, treino_id, rotina_id, concluido_em, feedback_nota, feedback_texto")
        .order("concluido_em", { ascending: false })
        .limit(12);

      if (!mounted) return;

      if (cErr || !concl) {
        setFeed([]);
        setConcluidosCount(0);
        setLoading(false);
        return;
      }

      setConcluidosCount(concl.length);

      const alunoIds = [...new Set((concl as any[]).map((x) => x.aluno_id))];
      const treinoIds = [...new Set((concl as any[]).map((x) => x.treino_id))];
      const rotinaIds = [...new Set((concl as any[]).map((x) => x.rotina_id))];

      const [alunosMini, treinosMini, rotinasMini] = await Promise.all([
        supabase.from("profiles").select("id, nome_completo, telefone, avatar_url").in("id", alunoIds),
        supabase.from("treinos").select("id, nome").in("id", treinoIds),
        supabase.from("rotinas_diarias").select("id, nome").in("id", rotinaIds),
      ]);

      const alunosMap = new Map((alunosMini.data || []).map((a: any) => [a.id, a]));
      const treinosMap = new Map((treinosMini.data || []).map((t: any) => [t.id, t]));
      const rotinasMap = new Map((rotinasMini.data || []).map((r: any) => [r.id, r]));

      const feedFinal: ConclusaoFeed[] = (concl as any[]).map((x) => ({
        ...x,
        aluno: alunosMap.get(x.aluno_id) || null,
        treino: treinosMap.get(x.treino_id) || null,
        rotina: rotinasMap.get(x.rotina_id) || null,
      }));

      setFeed(feedFinal);
      setLoading(false);
    }

    boot();
    return () => {
      mounted = false;
    };
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center text-lime-300 text-xl">
        Carregando dashboard do professor…
      </main>
    );
  }

  if (err) {
    return (
      <main className="min-h-screen bg-gray-950 text-white px-6 py-10">
        <div className="max-w-3xl mx-auto rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-red-200">{err}</p>
          <div className="mt-4 flex gap-2">
            <Link
              href="/login"
              className="rounded-2xl bg-lime-400 px-4 py-2 text-sm font-bold text-black hover:bg-lime-300"
            >
              Ir para login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const profId = prof?.id || null;

  return (
    <main className="min-h-screen bg-gray-950 text-white px-6 py-10">
      <div className="max-w-7xl mx-auto">
        {/* HERO */}
        <div className="rounded-[2rem] border border-white/10 bg-white/5 overflow-hidden shadow-2xl">
          <div className="relative h-48 w-full">
            {prof?.cover_url ? (
              <Image src={prof.cover_url} alt="Capa" fill className="object-cover" priority />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-lime-400/20 via-black/40 to-black" />
            )}
            <div className="absolute inset-0 bg-black/45" />
          </div>

          <div className="p-6 -mt-10 flex flex-col md:flex-row md:items-end md:justify-between gap-5">
            <div className="flex items-end gap-4">
              <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                {prof?.avatar_url ? (
                  <Image src={prof.avatar_url} alt="Avatar" fill className="object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-lime-300 font-extrabold text-2xl">
                    {(profName || "M").slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>

              <div>
                <p className="text-white/60 text-sm">Professor • Motion</p>
                <h1 className="text-3xl font-extrabold">
                  Bem-vindo, <span className="text-lime-300">{profName}</span>
                </h1>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Pill>Alunos: {alunosCount}</Pill>
                  <Pill>Planos atribuídos: {treinosCount}</Pill>
                  <Pill>Concluídos: {concluidosCount}</Pill>
                  <Pill>Pendentes: {pendingCount}</Pill>
                </div>
              </div>
            </div>

            {/* Ações rápidas */}
            <div className="flex flex-wrap gap-2">
              <Link
                href="/professor/perfil-publico"
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/80 hover:bg-white/10"
              >
                Meu perfil público
              </Link>

              <Link
                href="/professor/biblioteca"
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/80 hover:bg-white/10"
              >
                Biblioteca
              </Link>

              <Link
                href="/professor/community"
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/80 hover:bg-white/10 transition"
              >
                Comunidade (moderar)
              </Link>

              <Link
                href="/professor/treinos"
                className="rounded-2xl bg-lime-400 px-4 py-2 text-sm font-extrabold text-black hover:bg-lime-300"
              >
                Criar/atribuir treino
              </Link>

              <button
                onClick={copyPublicLink}
                disabled={!publicLink}
                className="rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-sm font-bold text-lime-300 hover:bg-white/5 disabled:opacity-40"
              >
                Copiar link “Treinar comigo”
              </button>
            </div>
          </div>
        </div>

        {/* STATS */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard title="Alunos" value={alunosCount} hint="Alunos vinculados ao seu perfil" />
          <StatCard title="Planos atribuídos" value={treinosCount} hint="Treinos criados/atribuídos por você" />
          <StatCard title="Concluídos (recentes)" value={concluidosCount} hint="Últimas rotinas concluídas (feed)" />
          <StatCard title="Pendências PIX" value={pendingCount} hint="Aguardando sua validação manual" />
        </div>

        {/* ✅ NOVO: PENDÊNCIAS */}
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="p-5 border-b border-white/10 flex items-center justify-between">
            <div>
              <p className="font-extrabold text-white">Assinaturas pendentes (PIX manual)</p>
              <p className="text-sm text-white/50">Quando o aluno envia comprovante, aparece aqui para você aprovar.</p>
            </div>

            <button
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/80 hover:bg-white/10"
              onClick={() => profId && loadPendencias(profId)}
              disabled={!profId || pendingBusyId !== null}
              title="Recarregar pendências"
            >
              ↻ Atualizar
            </button>
          </div>

          <div className="p-5 space-y-3">
            {pending.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-white/70">
                Nenhuma pendência no momento.
                <p className="mt-2 text-white/50 text-sm">
                  Para aparecer aqui, o aluno precisa gerar uma solicitação com status <b>pending</b> na tabela{" "}
                  <b>aluno_assinaturas</b>.
                </p>
              </div>
            ) : (
              pending.map((p) => {
                const alunoNome = p.aluno?.nome_completo || "Aluno";
                const alunoTel = p.aluno?.telefone || "";
                const alunoWa = alunoTel
                  ? waLink(
                      alunoTel,
                      `Olá, ${alunoNome}! Vi seu comprovante no Motion. Vou validar e liberar seu acesso. ✅`
                    )
                  : null;

                const busy = pendingBusyId === p.id;

                return (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-white/10 bg-black/30 p-4 flex flex-col md:flex-row md:items-center gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="relative h-10 w-10 rounded-xl overflow-hidden border border-white/10 bg-black/40 flex-shrink-0">
                        {p.aluno?.avatar_url ? (
                          <Image src={p.aluno.avatar_url} alt="Aluno" fill className="object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-lime-300 font-extrabold">
                            {(alunoNome || "A").slice(0, 1).toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="font-bold text-white truncate">{alunoNome}</p>
                        <p className="text-xs text-white/50 truncate">
                          Solicitado em {formatDate(p.created_at)} • Plano: <b>{p.duration_days} dias</b>
                        </p>
                        {p.note ? <p className="text-xs text-white/40 truncate">Nota: {p.note}</p> : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 justify-end">
                      {alunoWa ? (
                        <a
                          href={alunoWa}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-lime-300 hover:bg-white/10"
                        >
                          WhatsApp
                        </a>
                      ) : null}

                      <button
                        disabled={!profId || busy}
                        onClick={() => profId && aprovarPendencia(p, profId)}
                        className="rounded-xl bg-lime-400 px-4 py-2 text-xs font-extrabold text-black hover:bg-lime-300 disabled:opacity-60"
                      >
                        {busy ? "Processando..." : "Aprovar e ativar"}
                      </button>

                      <button
                        disabled={!profId || busy}
                        onClick={() => profId && cancelarPendencia(p, profId)}
                        className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-2 text-xs font-bold text-red-200 hover:bg-red-400/15 disabled:opacity-60"
                      >
                        Cancelar
                      </button>

                      <Link
                        href={`/professor/alunos/${p.aluno_id}/financeiro`}
                        className="rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-xs font-bold text-white/80 hover:bg-white/5"
                      >
                        Abrir financeiro →
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* GRID */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Alunos */}
          <div className="lg:col-span-1 rounded-3xl border border-white/10 bg-white/5 overflow-hidden">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <p className="font-extrabold text-white">Seus alunos</p>
              <Link href="/professor/alunos" className="text-sm font-bold text-lime-300 hover:underline">
                Ver tudo
              </Link>
            </div>

            <div className="p-5 space-y-3">
              {alunos.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-white/70">
                  Você ainda não tem alunos vinculados.
                  <p className="mt-2 text-white/50 text-sm">
                    Dica: use o link “Treinar comigo” no seu Instagram/WhatsApp.
                  </p>
                </div>
              ) : (
                alunos.slice(0, 6).map((a) => {
                  const wa = a.telefone
                    ? waLink(a.telefone, `Olá, ${a.nome_completo || "aluno"}! Tudo certo com seus treinos no Motion?`)
                    : null;

                  return (
                    <div
                      key={a.id}
                      className="rounded-2xl border border-white/10 bg-black/30 p-4 flex items-center gap-3"
                    >
                      <div className="relative h-10 w-10 rounded-xl overflow-hidden border border-white/10 bg-black/40 flex-shrink-0">
                        {a.avatar_url ? (
                          <Image src={a.avatar_url} alt="Aluno" fill className="object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-lime-300 font-extrabold">
                            {(a.nome_completo || "A").slice(0, 1).toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-white truncate">{a.nome_completo || "Aluno"}</p>
                        <p className="text-xs text-white/50 truncate">{a.telefone || "sem telefone"}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link
                          href={`/professor/alunos/${a.id}/financeiro`}
                          className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold text-white/80 hover:bg-white/5"
                        >
                          Financeiro
                        </Link>

                        {wa ? (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-lime-300 hover:bg-white/10"
                          >
                            WhatsApp
                          </a>
                        ) : (
                          <span className="text-xs text-white/40">—</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              <div className="pt-2">
                <Link
                  href="/professor/treinos"
                  className="block text-center rounded-2xl bg-lime-400 px-4 py-3 text-sm font-extrabold text-black hover:bg-lime-300"
                >
                  Criar e atribuir treino agora
                </Link>
              </div>
            </div>
          </div>

          {/* Feed Concluídos */}
          <div className="lg:col-span-2 rounded-3xl border border-white/10 bg-white/5 overflow-hidden">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div>
                <p className="font-extrabold text-white">Últimos treinos concluídos</p>
                <p className="text-sm text-white/50">Veja feedback e reaja rápido (nível premium Motion).</p>
              </div>
              {publicLink ? (
                <a
                  href={publicLink}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/80 hover:bg-white/10"
                >
                  Abrir meu perfil
                </a>
              ) : null}
            </div>

            <div className="p-5 space-y-3">
              {feed.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-white/70">
                  Nenhuma rotina concluída apareceu ainda.
                  <p className="mt-2 text-white/50 text-sm">
                    Se isso for inesperado, confira a policy de RLS de <b>aluno_rotina_conclusoes</b>.
                  </p>
                </div>
              ) : (
                feed.map((x) => {
                  const alunoNome = x.aluno?.nome_completo || "Aluno";
                  const rotNome = x.rotina?.nome || "Rotina";
                  const treinoNome = x.treino?.nome || "Treino";
                  const when = new Date(x.concluido_em).toLocaleString("pt-BR");

                  const alunoWa = x.aluno?.telefone
                    ? waLink(
                        x.aluno.telefone,
                        `Oi, ${alunoNome}! Vi que você concluiu "${rotNome}" (${treinoNome}) no Motion. Me conta como foi? 💪`
                      )
                    : null;

                  return (
                    <div key={x.id} className="rounded-2xl border border-white/10 bg-black/30 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-white font-extrabold truncate">
                            {alunoNome} <span className="text-white/50 font-bold">•</span>{" "}
                            <span className="text-lime-300">{rotNome}</span>
                          </p>
                          <p className="text-xs text-white/50 mt-1">
                            {treinoNome} • Concluído em {when}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {typeof x.feedback_nota === "number" ? (
                            <span className="rounded-full border border-lime-300/30 bg-lime-400/10 px-3 py-1 text-xs font-extrabold text-lime-300">
                              Nota {x.feedback_nota}/5
                            </span>
                          ) : (
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-white/60">
                              Sem nota
                            </span>
                          )}

                          {alunoWa ? (
                            <a
                              href={alunoWa}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-lime-300 hover:bg-white/10"
                            >
                              WhatsApp
                            </a>
                          ) : null}
                        </div>
                      </div>

                      {x.feedback_texto ? (
                        <div className="mt-3 rounded-2xl border border-white/10 bg-black/40 p-4 text-white/70 text-sm">
                          “{x.feedback_texto}”
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-white/50">
                          Sem comentário — você pode chamar no WhatsApp e pedir um feedback rápido.
                        </p>
                      )}
                    </div>
                  );
                })
              )}

              <div className="pt-2 flex flex-wrap gap-2">
                <Link
                  href="/professor/treinos"
                  className="rounded-2xl bg-lime-400 px-4 py-2 text-sm font-extrabold text-black hover:bg-lime-300"
                >
                  Atribuir novo plano
                </Link>

                <Link
                  href="/professor/perfil-publico"
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/80 hover:bg-white/10"
                >
                  Ajustar perfil público
                </Link>

                {publicLink ? (
                  <button
                    onClick={copyPublicLink}
                    className="rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-sm font-bold text-lime-300 hover:bg-white/5"
                  >
                    Copiar link “Treinar comigo”
                  </button>
                ) : (
                  <span className="text-sm text-white/50">
                    Configure seu <b>slug</b> no perfil público para gerar o link.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="mt-8 text-center text-xs text-white/40">Motion • Dashboard do Professor</div>
      </div>
    </main>
  );
}