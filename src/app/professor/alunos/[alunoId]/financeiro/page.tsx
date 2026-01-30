"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/utils/supabase-browser";
import { useProfessorGuard } from "@/app/professor/_guard/useProfessorGuard";

type AlunoLite = {
  id: string;
  nome_completo: string | null;
  telefone: string | null;
  professor_id: string | null;
  role: string | null;
};

type AssinaturaStatus = "pending" | "active" | "expired" | "canceled";

type Assinatura = {
  id: string;
  professor_id: string;
  aluno_id: string;
  plano_id: string | null;
  duration_days: number;
  status: AssinaturaStatus;
  start_at: string | null;
  end_at: string | null;
  note: string | null;
  activated_by: string | null;
  created_at: string;
  updated_at: string;
};

function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}

function toWhatsAppLink(phone?: string | null) {
  const d = onlyDigits(phone || "");
  if (!d) return null;

  // Se o número não tiver país, assume BR (55)
  const withCountry = d.startsWith("55") ? d : `55${d}`;
  return `https://wa.me/${withCountry}`;
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
  if (Number.isNaN(end)) return null;

  const now = Date.now();
  const diff = end - now;
  const days = Math.ceil(diff / 86400000);

  // Não mostra negativo
  return Math.max(0, days);
}

function endOfDayPlusDays(days: number) {
  const start = new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export default function FinanceiroAlunoPage() {
  const { alunoId } = useParams<{ alunoId: string }>();
  const { ok, loading: guardLoading } = useProfessorGuard();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const [profId, setProfId] = useState<string | null>(null);
  const [aluno, setAluno] = useState<AlunoLite | null>(null);
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null);

  function showOk(msg: string) {
    setToast({ type: "ok", msg });
    setTimeout(() => setToast(null), 2500);
  }

  function showErr(msg: string) {
    setToast({ type: "err", msg });
    setTimeout(() => setToast(null), 3500);
  }

  const statusLabel = useMemo(() => {
    if (!assinatura) return "Sem assinatura";
    if (assinatura.status === "active") return "Ativa";
    if (assinatura.status === "pending") return "Pendente";
    if (assinatura.status === "expired") return "Vencida";
    return "Cancelada";
  }, [assinatura]);

  const restante = useMemo(() => {
    if (!assinatura) return null;
    if (assinatura.status !== "active") return null;
    return daysLeft(assinatura.end_at);
  }, [assinatura]);

  const waLink = useMemo(() => toWhatsAppLink(aluno?.telefone), [aluno?.telefone]);

  async function load() {
    setLoading(true);
    setErr(null);

    const { data: auth, error: authError } = await supabase.auth.getUser();
    const user = auth?.user;

    if (authError || !user) {
      setErr("Sessão inválida. Faça login novamente.");
      setLoading(false);
      return;
    }

    setProfId(user.id);

    // Aluno
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

    setAluno(alunoData as AlunoLite);

    // Última assinatura (sempre do professor logado)
    const { data: asData, error: asErr } = await supabase
      .from("aluno_assinaturas")
      .select(
        "id, professor_id, aluno_id, plano_id, duration_days, status, start_at, end_at, note, activated_by, created_at, updated_at"
      )
      .eq("aluno_id", alunoId)
      .eq("professor_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (asErr) {
      console.warn("Erro carregando assinatura:", asErr.message);
      setAssinatura(null);
      setLoading(false);
      return;
    }

    setAssinatura((asData as Assinatura) || null);
    setLoading(false);
  }

  useEffect(() => {
    if (!ok) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok, alunoId]);

  // Cria uma assinatura PENDENTE (aluno enviou comprovante)
  async function criarPendente(dias: 30 | 90 | 180) {
    if (!profId) return;
    setBusy(true);
    setErr(null);
    setToast(null);

    try {
      // Opcional: se já existe uma pending recente, evita duplicar
      if (assinatura?.status === "pending") {
        showErr("Já existe uma solicitação pendente para este aluno.");
        return;
      }

      const { error } = await supabase.from("aluno_assinaturas").insert({
        professor_id: profId,
        aluno_id: alunoId,
        duration_days: dias,
        status: "pending",
        start_at: null,
        end_at: null,
        activated_by: null,
        note: `Solicitação pendente: ${dias} dias (aguardando validação do PIX)`,
      });

      if (error) throw error;

      showOk(`Solicitação criada (${dias} dias) como PENDENTE.`);
      await load();
    } catch (e: any) {
      showErr(e?.message || "Erro ao criar solicitação pendente.");
    } finally {
      setBusy(false);
    }
  }

  // Ativa assinatura (vira active, calcula datas, expira antigas)
  async function ativar(dias: 30 | 90 | 180) {
    if (!profId) return;
    setBusy(true);
    setErr(null);
    setToast(null);

    try {
      // 1) expira qualquer active anterior
      const { error: closeErr } = await supabase
        .from("aluno_assinaturas")
        .update({ status: "expired" })
        .eq("aluno_id", alunoId)
        .eq("professor_id", profId)
        .eq("status", "active");

      if (closeErr) throw closeErr;

      const { start, end } = endOfDayPlusDays(dias);

      // 2) se existe "pending", a gente atualiza ela pra active.
      // Senão, cria uma nova.
      if (assinatura?.status === "pending") {
        const { error } = await supabase
          .from("aluno_assinaturas")
          .update({
            status: "active",
            start_at: start.toISOString(),
            end_at: end.toISOString(),
            activated_by: profId,
            note: `Ativado manualmente: ${dias} dias`,
            duration_days: dias,
          })
          .eq("id", assinatura.id)
          .eq("professor_id", profId);

        if (error) throw error;

        showOk(`Assinatura PENDENTE ativada por ${dias} dias.`);
        await load();
        return;
      }

      // 3) cria nova assinatura active
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

      showOk(`Assinatura ativada por ${dias} dias.`);
      await load();
    } catch (e: any) {
      showErr(e?.message || "Erro ao ativar assinatura.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelar() {
    if (!assinatura) return;
    setBusy(true);
    setErr(null);
    setToast(null);

    try {
      const { error } = await supabase
        .from("aluno_assinaturas")
        .update({ status: "canceled" })
        .eq("id", assinatura.id)
        .eq("professor_id", profId!);

      if (error) throw error;

      showOk("Assinatura cancelada.");
      await load();
    } catch (e: any) {
      showErr(e?.message || "Erro ao cancelar.");
    } finally {
      setBusy(false);
    }
  }

  async function expirarAgora() {
    if (!assinatura) return;
    setBusy(true);
    setErr(null);
    setToast(null);

    try {
      const { error } = await supabase
        .from("aluno_assinaturas")
        .update({ status: "expired", end_at: new Date().toISOString() })
        .eq("id", assinatura.id)
        .eq("professor_id", profId!);

      if (error) throw error;

      showOk("Assinatura marcada como vencida agora.");
      await load();
    } catch (e: any) {
      showErr(e?.message || "Erro ao expirar.");
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

              <div className="mt-2 flex flex-wrap gap-2 items-center">
                <span className="text-white/60 text-sm">
                  WhatsApp: {aluno?.telefone ? onlyDigits(aluno.telefone) : "—"}
                </span>

                {waLink ? (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-lime-400/20 bg-lime-400/10 px-3 py-1 text-xs text-lime-200 hover:bg-lime-400/15"
                  >
                    Chamar no WhatsApp ↗
                  </a>
                ) : null}
              </div>

              <p className="text-white/40 text-xs mt-2 break-all">ID: {alunoId}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 min-w-[220px]">
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

          {toast ? (
            <div
              className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                toast.type === "ok"
                  ? "border-lime-400/20 bg-lime-400/10 text-lime-200"
                  : "border-red-400/20 bg-red-400/10 text-red-200"
              }`}
            >
              {toast.msg}
            </div>
          ) : null}
        </div>

        {/* Card assinatura */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <p className="font-extrabold">Assinatura</p>
              <p className="text-sm text-white/60 mt-1">
                Controle manual (PIX): crie pendente quando o aluno enviar comprovante e ative quando validar.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
              <p className="text-xs text-white/50">Atualizado em</p>
              <p className="text-white font-bold">{formatDate(assinatura?.updated_at)}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
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
              <p className="text-xs text-white/50">Status raw</p>
              <p className="text-white font-bold">{assinatura?.status || "—"}</p>
            </div>
          </div>

          {assinatura?.note ? (
            <div className="mt-3 text-sm text-white/60">
              Nota: <span className="text-white/80">{assinatura.note}</span>
            </div>
          ) : null}

          {/* Ações */}
          <div className="mt-6 space-y-3">
            <div className="text-xs text-white/50">
              <b>Fluxo recomendado:</b> aluno envia PIX → você cria <b>pendente</b> → valida e ativa.
            </div>

            <div className="flex flex-col lg:flex-row gap-2">
              {/* Criar pendente */}
              <button
                disabled={busy}
                onClick={() => criarPendente(30)}
                className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 px-5 py-3 text-sm font-extrabold text-yellow-100 hover:bg-yellow-400/15 disabled:opacity-60"
              >
                Criar pendente 30 dias
              </button>
              <button
                disabled={busy}
                onClick={() => criarPendente(90)}
                className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 px-5 py-3 text-sm font-extrabold text-yellow-100 hover:bg-yellow-400/15 disabled:opacity-60"
              >
                Criar pendente 90 dias
              </button>
              <button
                disabled={busy}
                onClick={() => criarPendente(180)}
                className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 px-5 py-3 text-sm font-extrabold text-yellow-100 hover:bg-yellow-400/15 disabled:opacity-60"
              >
                Criar pendente 180 dias
              </button>

              <div className="flex-1" />
            </div>

            <div className="flex flex-col lg:flex-row gap-2">
              {/* Ativar */}
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

              {/* Ações perigosas */}
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

            <div className="text-xs text-white/40">
              Quando você ativa um novo plano, o sistema marca qualquer assinatura <b>active</b> anterior como{" "}
              <b>expired</b> para evitar duplicidade.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}