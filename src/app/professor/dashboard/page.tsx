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

type ProfAssinatura = {
  status: string;
  trial_ends_at: string | null;
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
    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/60 text-xs">
      {children}
    </span>
  );
}

function StatCard({ title, value, hint }: { title: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
      <p className="text-white/50 text-xs font-medium uppercase tracking-wide">{title}</p>
      <p className="mt-2 text-3xl font-bold text-white">{value}</p>
      {hint ? <p className="mt-1.5 text-white/40 text-xs">{hint}</p> : null}
    </div>
  );
}

// Toast simples (substitui alert())
type Toast = { id: number; msg: string; kind: "info" | "ok" | "err" };
let _toastId = 0;

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  function push(msg: string, kind: Toast["kind"] = "info") {
    const id = ++_toastId;
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }

  return { toasts, push };
}

function ToastList({ toasts }: { toasts: Toast[] }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-24 lg:bottom-6 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rounded-xl px-4 py-3 text-sm font-medium shadow-xl border animate-in fade-in slide-in-from-bottom-2 ${
            t.kind === "ok"
              ? "bg-white text-black border-white/20"
              : t.kind === "err"
              ? "bg-red-500/10 text-red-200 border-red-500/20"
              : "bg-white/10 text-white border-white/10"
          }`}
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
}

export default function ProfessorDashboard() {
  const router = useRouter();
  const { toasts, push } = useToast();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [prof, setProf] = useState<ProfProfile | null>(null);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [feed, setFeed] = useState<ConclusaoFeed[]>([]);

  const [treinosCount, setTreinosCount] = useState(0);
  const [alunosCount, setAlunosCount] = useState(0);
  const [concluidosCount, setConcluidosCount] = useState(0);

  const [assinatura, setAssinatura] = useState<ProfAssinatura | null>(null);

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
      push("Link copiado!", "ok");
    } catch {
      push("Copie manualmente: " + publicLink, "info");
    }
  }

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

    setPending(
      (pend as any[]).map((x) => ({ ...x, aluno: alunosMap.get(x.aluno_id) || null }))
    );
  }

  async function aprovarPendencia(p: PendingItem, profId: string) {
    setPendingBusyId(p.id);
    try {
      const { error: closeErr } = await supabase
        .from("aluno_assinaturas")
        .update({ status: "expired" })
        .eq("aluno_id", p.aluno_id)
        .eq("status", "active");
      if (closeErr) throw closeErr;

      const start = new Date();
      const end = new Date(start);
      end.setDate(end.getDate() + Number(p.duration_days));
      end.setHours(23, 59, 59, 999);

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

      await loadPendencias(profId);
      push(`Assinatura ativada: ${p.duration_days} dias.`, "ok");
    } catch (e: any) {
      push(e?.message || "Erro ao aprovar pendência.", "err");
    } finally {
      setPendingBusyId(null);
    }
  }

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
      push("Pendência cancelada.", "info");
    } catch (e: any) {
      push(e?.message || "Erro ao cancelar pendência.", "err");
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
      if (authError || !user) { router.replace("/login"); return; }

      const { data: myProf, error: pErr } = await supabase
        .from("profiles")
        .select("id, role, nome_completo, telefone, avatar_url, cover_url, slug")
        .eq("id", user.id)
        .single();

      if (!mounted) return;
      if (pErr || !myProf) { setErr("Não foi possível carregar seu perfil."); setLoading(false); return; }
      if (myProf.role !== "professor") { router.replace("/dashboard"); return; }

      setProf(myProf as ProfProfile);

      const { data: assinData } = await supabase
        .from("professor_assinaturas")
        .select("status, trial_ends_at")
        .eq("professor_id", user.id)
        .maybeSingle();
      if (assinData) setAssinatura(assinData as ProfAssinatura);

      await loadPendencias(user.id);

      const { data: alunosData, error: aErr } = await supabase
        .from("profiles")
        .select("id, nome_completo, telefone, avatar_url")
        .eq("professor_id", user.id)
        .eq("role", "aluno")
        .order("created_at", { ascending: false });

      if (!mounted) return;
      if (!aErr && alunosData) { setAlunos(alunosData as any); setAlunosCount(alunosData.length); }

      const { count: tCount } = await supabase
        .from("treinos")
        .select("id", { count: "exact", head: true })
        .eq("professor_id", user.id);
      setTreinosCount(tCount || 0);

      const { data: concl, error: cErr } = await supabase
        .from("aluno_rotina_conclusoes")
        .select("id, aluno_id, treino_id, rotina_id, concluido_em, feedback_nota, feedback_texto")
        .order("concluido_em", { ascending: false })
        .limit(12);

      if (!mounted) return;
      if (cErr || !concl) { setConcluidosCount(0); setLoading(false); return; }

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

      setFeed(
        (concl as any[]).map((x) => ({
          ...x,
          aluno: alunosMap.get(x.aluno_id) || null,
          treino: treinosMap.get(x.treino_id) || null,
          rotina: rotinasMap.get(x.rotina_id) || null,
        }))
      );
      setLoading(false);
    }

    boot();
    return () => { mounted = false; };
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-white/40 text-sm">Carregando…</p>
      </div>
    );
  }

  if (err) {
    return (
      <div className="p-6 max-w-lg mx-auto mt-10">
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
          <p className="text-red-300 text-sm">{err}</p>
          <Link href="/login" className="mt-4 inline-block rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90">
            Ir para login
          </Link>
        </div>
      </div>
    );
  }

  const profId = prof?.id || null;

  const trialDaysLeft = assinatura?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(assinatura.trial_ends_at).getTime() - Date.now()) / 86400000))
    : null;

  return (
    <>
      <ToastList toasts={toasts} />

      <div className="px-5 py-8 max-w-7xl mx-auto space-y-6">
        {/* ── Banner de trial ───────────────────────────────────────────────── */}
        {assinatura?.status === "trial" && (
          <div className="rounded-2xl border border-amber-400/15 bg-amber-400/[0.04] px-5 py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-amber-200">
                Período de teste
                {trialDaysLeft !== null && trialDaysLeft > 0
                  ? ` — ${trialDaysLeft} dia${trialDaysLeft !== 1 ? "s" : ""} restante${trialDaysLeft !== 1 ? "s" : ""}`
                  : " — expira hoje"}
              </p>
              <p className="text-xs text-amber-200/60 mt-0.5">
                Após o trial, R$ 59,90/mês para continuar usando o Motion.
              </p>
            </div>
            <Link
              href="/professor/pricing"
              className="shrink-0 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90 transition-colors"
            >
              Assinar agora
            </Link>
          </div>
        )}

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] overflow-hidden">
          {/* Cover */}
          <div className="relative h-40 w-full">
            {prof?.cover_url ? (
              <Image src={prof.cover_url} alt="Capa" fill className="object-cover" priority />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent" />
            )}
            <div className="absolute inset-0 bg-black/50" />
          </div>

          {/* Profile row */}
          <div className="px-6 pb-6 -mt-9 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div className="flex items-end gap-4">
              <div className="relative h-16 w-16 overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0a] shrink-0">
                {prof?.avatar_url ? (
                  <Image src={prof.avatar_url} alt="Avatar" fill className="object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-white font-bold text-xl">
                    {(profName).slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <p className="text-white/50 text-xs">Professor · Motion</p>
                <h1 className="text-xl font-semibold text-white mt-0.5">{profName}</h1>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Pill>Alunos: {alunosCount}</Pill>
                  <Pill>Planos: {treinosCount}</Pill>
                  <Pill>Concluídos: {concluidosCount}</Pill>
                  {pendingCount > 0 && (
                    <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-amber-300 text-xs">
                      {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick actions */}
            <div className="flex flex-wrap gap-2">
              <Link
                href="/professor/perfil-publico"
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white/70 hover:bg-white/10 transition-colors"
              >
                Perfil público
              </Link>
              <Link
                href="/professor/biblioteca"
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white/70 hover:bg-white/10 transition-colors"
              >
                Biblioteca
              </Link>
              <Link
                href="/professor/treinos"
                className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-black hover:bg-white/90 transition-colors"
              >
                Criar treino
              </Link>
              <button
                onClick={copyPublicLink}
                disabled={!publicLink}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white/70 hover:bg-white/10 disabled:opacity-40 transition-colors"
              >
                Copiar link público
              </button>
            </div>
          </div>
        </div>

        {/* ── Stats ─────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard title="Alunos" value={alunosCount} hint="Vinculados ao seu perfil" />
          <StatCard title="Planos atribuídos" value={treinosCount} hint="Criados por você" />
          <StatCard title="Concluídos" value={concluidosCount} hint="Últimas rotinas (feed)" />
          <StatCard title="Pendências PIX" value={pendingCount} hint="Aguardando validação" />
        </div>

        {/* ── Pendências ────────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between">
            <div>
              <p className="font-semibold text-white text-sm">Assinaturas pendentes (PIX manual)</p>
              <p className="text-xs text-white/40 mt-0.5">Aprovação manual após o aluno enviar comprovante.</p>
            </div>
            <button
              onClick={() => profId && loadPendencias(profId)}
              disabled={!profId || pendingBusyId !== null}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 hover:bg-white/10 disabled:opacity-40 transition-colors"
            >
              Atualizar
            </button>
          </div>

          <div className="p-5 space-y-3">
            {pending.length === 0 ? (
              <p className="text-white/40 text-sm">Nenhuma pendência no momento.</p>
            ) : (
              pending.map((p) => {
                const alunoNome = p.aluno?.nome_completo || "Aluno";
                const alunoTel = p.aluno?.telefone || "";
                const alunoWa = alunoTel
                  ? waLink(alunoTel, `Olá, ${alunoNome}! Vi seu comprovante no Motion. Vou validar e liberar seu acesso. ✅`)
                  : null;
                const busy = pendingBusyId === p.id;

                return (
                  <div
                    key={p.id}
                    className="rounded-xl border border-white/8 bg-white/[0.02] p-4 flex flex-col sm:flex-row sm:items-center gap-3"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="relative h-9 w-9 rounded-lg overflow-hidden border border-white/10 bg-[#0a0a0a] shrink-0">
                        {p.aluno?.avatar_url ? (
                          <Image src={p.aluno.avatar_url} alt="Aluno" fill className="object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-white font-semibold text-sm">
                            {(alunoNome).slice(0, 1).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-white text-sm truncate">{alunoNome}</p>
                        <p className="text-xs text-white/40 truncate">
                          {formatDate(p.created_at)} · <span className="text-white/60">{p.duration_days} dias</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {alunoWa && (
                        <a href={alunoWa} target="_blank" rel="noreferrer"
                          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 transition-colors">
                          WhatsApp
                        </a>
                      )}
                      <button
                        disabled={!profId || busy}
                        onClick={() => profId && aprovarPendencia(p, profId)}
                        className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-white/90 disabled:opacity-50 transition-colors"
                      >
                        {busy ? "Processando…" : "Aprovar"}
                      </button>
                      <button
                        disabled={!profId || busy}
                        onClick={() => profId && cancelarPendencia(p, profId)}
                        className="rounded-lg border border-red-400/15 bg-red-400/8 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-400/12 disabled:opacity-50 transition-colors"
                      >
                        Cancelar
                      </button>
                      <Link
                        href={`/professor/alunos/${p.aluno_id}/financeiro`}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 hover:bg-white/10 transition-colors"
                      >
                        Financeiro →
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Grid: Alunos + Feed ───────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Alunos */}
          <div className="lg:col-span-1 rounded-2xl border border-white/8 bg-white/[0.03] overflow-hidden">
            <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between">
              <p className="font-semibold text-white text-sm">Seus alunos</p>
              <Link href="/professor/alunos" className="text-xs font-medium text-white/50 hover:text-white transition-colors">
                Ver tudo →
              </Link>
            </div>

            <div className="p-4 space-y-2">
              {alunos.length === 0 ? (
                <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
                  <p className="text-white/50 text-sm">Você ainda não tem alunos vinculados.</p>
                  <p className="mt-1 text-white/30 text-xs">Use o link público no seu Instagram/WhatsApp.</p>
                </div>
              ) : (
                alunos.slice(0, 6).map((a) => {
                  const wa = a.telefone
                    ? waLink(a.telefone, `Olá, ${a.nome_completo || "aluno"}! Tudo certo com seus treinos no Motion?`)
                    : null;
                  return (
                    <div key={a.id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-3">
                      <div className="relative h-9 w-9 rounded-lg overflow-hidden border border-white/10 bg-[#0a0a0a] shrink-0">
                        {a.avatar_url ? (
                          <Image src={a.avatar_url} alt="Aluno" fill className="object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-white font-semibold text-sm">
                            {(a.nome_completo || "A").slice(0, 1).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-white text-sm truncate">{a.nome_completo || "Aluno"}</p>
                        <p className="text-xs text-white/40 truncate">{a.telefone || "sem telefone"}</p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <Link href={`/professor/alunos/${a.id}/financeiro`}
                          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/60 hover:bg-white/10 transition-colors">
                          Fin.
                        </Link>
                        {wa && (
                          <a href={wa} target="_blank" rel="noreferrer"
                            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/60 hover:bg-white/10 transition-colors">
                            WA
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              <div className="pt-1">
                <Link
                  href="/professor/treinos"
                  className="block text-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-white/90 transition-colors"
                >
                  Criar e atribuir treino
                </Link>
              </div>
            </div>
          </div>

          {/* Feed concluídos */}
          <div className="lg:col-span-2 rounded-2xl border border-white/8 bg-white/[0.03] overflow-hidden">
            <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between">
              <div>
                <p className="font-semibold text-white text-sm">Últimos treinos concluídos</p>
                <p className="text-xs text-white/40 mt-0.5">Feedbacks dos seus alunos em tempo real.</p>
              </div>
              {publicLink && (
                <a href={publicLink} target="_blank" rel="noreferrer"
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 hover:bg-white/10 transition-colors">
                  Meu perfil
                </a>
              )}
            </div>

            <div className="p-4 space-y-3">
              {feed.length === 0 ? (
                <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
                  <p className="text-white/50 text-sm">Nenhuma rotina concluída ainda.</p>
                  <p className="mt-1 text-white/30 text-xs">Confira a policy de RLS de <span className="font-mono">aluno_rotina_conclusoes</span> se isso for inesperado.</p>
                </div>
              ) : (
                feed.map((x) => {
                  const alunoNome = x.aluno?.nome_completo || "Aluno";
                  const rotNome = x.rotina?.nome || "Rotina";
                  const treinoNome = x.treino?.nome || "Treino";
                  const when = new Date(x.concluido_em).toLocaleString("pt-BR");
                  const alunoWa = x.aluno?.telefone
                    ? waLink(x.aluno.telefone, `Oi, ${alunoNome}! Vi que você concluiu "${rotNome}" (${treinoNome}) no Motion. Me conta como foi? 💪`)
                    : null;

                  return (
                    <div key={x.id} className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-white font-medium text-sm truncate">
                            {alunoNome} <span className="text-white/30">·</span> <span className="text-white/70">{rotNome}</span>
                          </p>
                          <p className="text-xs text-white/40 mt-0.5">{treinoNome} · {when}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {typeof x.feedback_nota === "number" ? (
                            <span className="rounded-full border border-white/15 bg-white/8 px-2.5 py-1 text-xs font-medium text-white/80">
                              {x.feedback_nota}/5
                            </span>
                          ) : (
                            <span className="rounded-full border border-white/8 px-2.5 py-1 text-xs text-white/30">
                              sem nota
                            </span>
                          )}
                          {alunoWa && (
                            <a href={alunoWa} target="_blank" rel="noreferrer"
                              className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/60 hover:bg-white/10 transition-colors">
                              WA
                            </a>
                          )}
                        </div>
                      </div>
                      {x.feedback_texto && (
                        <p className="mt-2.5 text-xs text-white/50 italic border-l border-white/10 pl-3">
                          "{x.feedback_texto}"
                        </p>
                      )}
                    </div>
                  );
                })
              )}

              <div className="pt-1 flex flex-wrap gap-2">
                <Link
                  href="/professor/treinos"
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 transition-colors"
                >
                  Atribuir novo plano
                </Link>
                <Link
                  href="/professor/perfil-publico"
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/10 transition-colors"
                >
                  Ajustar perfil público
                </Link>
                {publicLink ? (
                  <button
                    onClick={copyPublicLink}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/10 transition-colors"
                  >
                    Copiar link público
                  </button>
                ) : (
                  <span className="text-xs text-white/30 self-center">Configure um slug no perfil público.</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-white/20 pb-2">Motion · Dashboard do Professor</p>
      </div>
    </>
  );
}
