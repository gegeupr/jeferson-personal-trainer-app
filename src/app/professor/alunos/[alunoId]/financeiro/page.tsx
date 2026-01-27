"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase-browser";
import { useProfessorGuard } from "@/app/professor/_guard/useProfessorGuard";

type AlunoLite = {
  id: string;
  nome_completo: string | null;
  telefone: string | null;
  professor_id: string | null;
  role: string | null;
};

type Assinatura = {
  id: string;
  professor_id: string;
  aluno_id: string;
  plano_id: string | null;
  duration_days: 30 | 90 | 180;
  status: "active" | "expired" | "canceled";
  start_at: string;
  end_at: string;
  note: string | null;
  activated_by: string | null;
  created_at: string;
  updated_at: string;
};

function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function daysLeft(endAt?: string | null) {
  if (!endAt) return null;
  const end = new Date(endAt).getTime();
  const now = Date.now();
  const diff = end - now;
  return Math.floor(diff / 86400000);
}

export default function FinanceiroAlunoPage() {
  const router = useRouter();
  const { alunoId } = useParams<{ alunoId: string }>();
  const { ok, loading: guardLoading } = useProfessorGuard();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [profId, setProfId] = useState<string | null>(null);
  const [aluno, setAluno] = useState<AlunoLite | null>(null);
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null);

  const statusLabel = useMemo(() => {
    if (!assinatura) return "Sem assinatura";
    if (assinatura.status === "active") return "Ativa";
    if (assinatura.status === "expired") return "Vencida";
    return "Cancelada";
  }, [assinatura]);

  const restante = useMemo(() => {
    if (!assinatura) return null;
    if (assinatura.status !== "active") return null;
    return daysLeft(assinatura.end_at);
  }, [assinatura]);

  async function load() {
    setLoading(true);
    setErr(null);
    setMsg(null);

    // professor logado
    const { data: auth, error: authError } = await supabase.auth.getUser();
    const user = auth?.user;

    if (authError || !user) {
      setErr("Sessão inválida.");
      setLoading(false);
      return;
    }

    setProfId(user.id);

    // aluno
    const { data: alunoData, error: aErr } = await supabase
      .from("profiles")
      .select("id, nome_completo, telefone, professor_id, role")
      .eq("id", alunoId)
      .single();

    if (aErr || !alunoData) {
      setErr("Aluno não encontrado.");
      setLoading(false);
      return;
    }

    // segurança extra (se já tiver RLS forte, pode remover)
    if ((alunoData.role || "").toLowerCase() !== "aluno") {
      setErr("Este usuário não é aluno.");
      setLoading(false);
      return;
    }
    if (alunoData.professor_id !== user.id) {
      setErr("Acesso negado: aluno não pertence ao seu perfil.");
      setLoading(false);
      return;
    }

    setAluno(alunoData as any);

    // última assinatura (mais recente)
    const { data: asData, error: asErr } = await supabase
      .from("aluno_assinaturas")
      .select(
        "id, professor_id, aluno_id, plano_id, duration_days, status, start_at, end_at, note, activated_by, created_at, updated_at"
      )
      .eq("aluno_id", alunoId)
      .order("end_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (asErr) {
      console.warn("Erro carregando assinatura:", asErr.message);
      setAssinatura(null);
      setLoading(false);
      return;
    }

    setAssinatura((asData as any) || null);
    setLoading(false);
  }

  useEffect(() => {
    if (!ok) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok, alunoId]);

  async function ativar(dias: 30 | 90 | 180) {
    if (!profId) return;
    setBusy(true);
    setErr(null);
    setMsg(null);

    try {
      // 1) encerra qualquer assinatura ativa anterior (evita duplicidade)
      const { error: closeErr } = await supabase
        .from("aluno_assinaturas")
        .update({ status: "expired" })
        .eq("aluno_id", alunoId)
        .eq("status", "active");

      if (closeErr) throw closeErr;

      // 2) cria nova assinatura
      const start = new Date();
      const end = new Date(start);
      end.setDate(end.getDate() + dias);
      end.setHours(23, 59, 59, 999);

      const { error } = await supabase.from("aluno_assinaturas").insert({
        professor_id: profId,
        aluno_id: alunoId,
        duration_days: dias,
        status: "active",
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        activated_by: profId,
        note: `Ativado manualmente: ${dias} dias`,
      });

      if (error) throw error;

      setMsg(`Assinatura ativada por ${dias} dias.`);
      await load();
    } catch (e: any) {
      setErr(e?.message || "Erro ao ativar assinatura.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelar() {
    if (!assinatura) return;
    setBusy(true);
    setErr(null);
    setMsg(null);

    try {
      const { error } = await supabase
        .from("aluno_assinaturas")
        .update({ status: "canceled" })
        .eq("id", assinatura.id);

      if (error) throw error;

      setMsg("Assinatura cancelada.");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Erro ao cancelar.");
    } finally {
      setBusy(false);
    }
  }

  async function expirarAgora() {
    if (!assinatura) return;
    setBusy(true);
    setErr(null);
    setMsg(null);

    try {
      const { error } = await supabase
        .from("aluno_assinaturas")
        .update({ status: "expired", end_at: new Date().toISOString() })
        .eq("id", assinatura.id);

      if (error) throw error;

      setMsg("Assinatura marcada como vencida agora.");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Erro ao expirar.");
    } finally {
      setBusy(false);
    }
  }

  if (guardLoading || loading) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-lime-300 text-lg">Carregando…</div>
      </main>
    );
  }

  if (!ok) return null;

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* TOP BAR */}
      <div className="sticky top-0 z-50 border-b border-white/10 bg-black/60 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href="/professor/alunos"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
            >
              ← Voltar para Alunos
            </Link>

            <button
              type="button"
              onClick={() => load()}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition disabled:opacity-60"
              title="Recarregar"
            >
              ↻ Atualizar
            </button>
          </div>

          <div className="text-sm text-white/70">Financeiro do aluno</div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 space-y-4">
        {/* Header aluno */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-white/60 text-sm">Aluno</p>
              <p className="text-2xl font-extrabold">{aluno?.nome_completo || "Aluno"}</p>
              <p className="text-white/50 text-sm">
                WhatsApp: {aluno?.telefone ? onlyDigits(aluno.telefone) : "—"}
              </p>
              <p className="text-white/40 text-xs mt-1">ID: {alunoId}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
              <p className="text-xs text-white/50">Status</p>
              <p className="text-lg font-extrabold text-lime-300">{statusLabel}</p>
              {restante !== null ? (
                <p className="text-xs text-white/50 mt-1">
                  Dias restantes: <span className="text-white">{restante}</span>
                </p>
              ) : null}
            </div>
          </div>

          {err ? (
            <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">
              {err}
            </div>
          ) : null}

          {msg ? (
            <div className="mt-4 rounded-2xl border border-lime-400/20 bg-lime-400/10 p-4 text-lime-200">
              {msg}
            </div>
          ) : null}
        </div>

        {/* Detalhes assinatura */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="font-extrabold">Assinatura</p>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs text-white/50">Início</p>
              <p className="text-white font-bold">{formatDate(assinatura?.start_at)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs text-white/50">Fim</p>
              <p className="text-white font-bold">{formatDate(assinatura?.end_at)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs text-white/50">Duração</p>
              <p className="text-white font-bold">
                {assinatura?.duration_days ? `${assinatura.duration_days} dias` : "—"}
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs text-white/50">Ativado por</p>
              <p className="text-white/80 text-sm break-all">{assinatura?.activated_by || "—"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs text-white/50">Plano (plano_id)</p>
              <p className="text-white/80 text-sm break-all">{assinatura?.plano_id || "—"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs text-white/50">Última atualização</p>
              <p className="text-white font-bold">{formatDate(assinatura?.updated_at)}</p>
            </div>
          </div>

          {assinatura?.note ? (
            <div className="mt-3 text-sm text-white/60">
              Nota: <span className="text-white/80">{assinatura.note}</span>
            </div>
          ) : null}

          <div className="mt-6 flex flex-col md:flex-row gap-2">
            <button
              disabled={busy}
              onClick={() => ativar(30)}
              className="rounded-2xl bg-lime-400 px-5 py-3 text-sm font-extrabold text-black hover:bg-lime-300 disabled:opacity-60"
            >
              Ativar 30 dias
            </button>
            <button
              disabled={busy}
              onClick={() => ativar(90)}
              className="rounded-2xl bg-lime-400 px-5 py-3 text-sm font-extrabold text-black hover:bg-lime-300 disabled:opacity-60"
            >
              Ativar 90 dias
            </button>
            <button
              disabled={busy}
              onClick={() => ativar(180)}
              className="rounded-2xl bg-lime-400 px-5 py-3 text-sm font-extrabold text-black hover:bg-lime-300 disabled:opacity-60"
            >
              Ativar 180 dias
            </button>

            <div className="flex-1" />

            <button
              disabled={busy || !assinatura}
              onClick={cancelar}
              className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold text-white/80 hover:bg-white/10 disabled:opacity-60"
            >
              Cancelar
            </button>

            <button
              disabled={busy || !assinatura}
              onClick={expirarAgora}
              className="rounded-2xl border border-red-400/20 bg-red-400/10 px-5 py-3 text-sm font-bold text-red-200 hover:bg-red-400/15 disabled:opacity-60"
            >
              Expirar agora
            </button>
          </div>

          <div className="mt-4 text-xs text-white/40">
            Dica: ao ativar um plano novo, o sistema marca qualquer assinatura ativa anterior como <b>expired</b>
            para evitar duplicidade.
          </div>
        </div>
      </div>
    </main>
  );
}