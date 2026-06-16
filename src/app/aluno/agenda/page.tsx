"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase-browser";
import {
  buscarAgendaAluno,
  criarAgendamento,
  informarPagamento,
  cancelarAgendamento,
  type AgendamentoComPartes,
  type ProfessorAgendaInfo,
} from "@/app/actions/agenda";
import {
  gerarSlotsDisponiveis,
  formatarDataHoraBR,
  formatarHoraBR,
  formatarValor,
  type DisponibilidadeSlot,
  type SlotGerado,
} from "@/lib/agenda-utils";
import Link from "next/link";

// ── Helpers visuais ───────────────────────────────────────────────────────────

const STATUS_INFO: Record<string, { label: string; cls: string }> = {
  confirmado:           { label: "Confirmado",       cls: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
  aguardando_pagamento: { label: "Aguard. Pix",      cls: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
  pagamento_informado:  { label: "Pix informado",    cls: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
  cancelado_professor:  { label: "Cancelado (prof.)",cls: "text-red-400 bg-red-400/10 border-red-400/20" },
  cancelado_aluno:      { label: "Cancelado",        cls: "text-red-400 bg-red-400/10 border-red-400/20" },
};

function formatarDataHeader(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long",
  });
}

function agruparPorData(slots: (SlotGerado & { ocupado: boolean })[]) {
  const map: Record<string, (SlotGerado & { ocupado: boolean })[]> = {};
  for (const s of slots) {
    const data = s.data_hora_inicio.slice(0, 10);
    if (!map[data]) map[data] = [];
    map[data].push(s);
  }
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
}

// ── Tipos do modal ─────────────────────────────────────────────────────────────

type ModalStep = "form" | "pix";

type ModalState = {
  slot: SlotGerado;
  step: ModalStep;
  obs: string;
  agendamentoId: string | null;
};

// ── Componente ────────────────────────────────────────────────────────────────

export default function AlunoAgendaPage() {
  const router = useRouter();

  const [alunoId, setAlunoId] = useState<string | null>(null);
  const [professor, setProfessor] = useState<ProfessorAgendaInfo | null>(null);
  const [disponibilidade, setDisponibilidade] = useState<DisponibilidadeSlot[]>([]);
  const [ocupados, setOcupados] = useState<string[]>([]);
  const [agendamentos, setAgendamentos] = useState<AgendamentoComPartes[]>([]);
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState<ModalState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: "ok" | "err" }[]>([]);
  const [confirmCancelar, setConfirmCancelar] = useState<{ msg: string; onOk: () => void } | null>(null);

  function toast(msg: string, kind: "ok" | "err") {
    const id = Date.now();
    setToasts((p) => [...p, { id, msg, kind }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
  }

  const carregar = useCallback(async (uid: string) => {
    const dados = await buscarAgendaAluno(uid);
    setProfessor(dados.professor);
    setDisponibilidade(dados.disponibilidade);
    setOcupados(dados.ocupados);
    setAgendamentos(dados.agendamentos);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      setAlunoId(user.id);
      carregar(user.id).finally(() => setLoading(false));
    });
  }, [router, carregar]);

  // ── Slots ──────────────────────────────────────────────────────────────────

  const ocupadosSet = new Set(ocupados);

  // Gera todos os slots (sem filtrar ocupados) para mostrar cinza
  const todosSlots = gerarSlotsDisponiveis(disponibilidade, [], 4).map((s) => ({
    ...s,
    ocupado: ocupadosSet.has(s.data_hora_inicio),
  }));

  const porData = agruparPorData(todosSlots);

  // ── Agendamento ───────────────────────────────────────────────────────────

  async function handleAgendar() {
    if (!modal || !alunoId || !professor) return;
    setSubmitting(true);
    const result = await criarAgendamento({
      profId: professor.id,
      alunoId,
      dataHoraInicio: modal.slot.data_hora_inicio,
      dataHoraFim: modal.slot.data_hora_fim,
      tipo: modal.slot.tipo,
      observacao: modal.obs.trim() || undefined,
      valorCobrado: modal.slot.valor,
    });
    setSubmitting(false);

    if (!result.ok) {
      toast(result.error, "err");
      if (result.error.includes("reservado")) {
        setModal(null);
        carregar(alunoId);
      }
      return;
    }

    if (modal.slot.valor === null) {
      // Gratuito → confirmado direto
      toast("Aula agendada com sucesso!", "ok");
      setModal(null);
      carregar(alunoId);
    } else {
      // Com valor → mostrar etapa Pix
      setModal((m) => m ? { ...m, step: "pix", agendamentoId: result.agendamentoId } : null);
    }
  }

  async function handleInformarPix() {
    if (!modal?.agendamentoId || !alunoId) return;
    setSubmitting(true);
    const result = await informarPagamento(modal.agendamentoId, alunoId);
    setSubmitting(false);
    if (!result.ok) { toast("Erro: " + result.error, "err"); return; }
    toast("Pix informado! Aguarde a confirmação do professor.", "ok");
    setModal(null);
    carregar(alunoId);
  }

  async function handleCancelar(agId: string, dataHora: string) {
    if (!alunoId) return;
    setConfirmCancelar({
      msg: `Cancelar a aula de ${formatarDataHoraBR(dataHora)}?`,
      onOk: async () => {
        const r = await cancelarAgendamento(agId, "aluno", alunoId);
        if (!r.ok) { toast("Erro: " + r.error, "err"); return; }
        toast("Aula cancelada.", "ok");
        carregar(alunoId);
      },
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-white/40 text-sm">Carregando agenda…</p>
      </div>
    );
  }

  if (!professor) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-3">
          <p className="text-white/60 text-sm">Você ainda não está vinculado a um professor.</p>
          <Link href="/aluno/dashboard" className="inline-block rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 hover:bg-white/10 transition-colors">
            ← Voltar ao dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-4 py-8 pb-28">
      <div className="max-w-2xl mx-auto space-y-8">

        {/* Header */}
        <div>
          <Link href="/aluno/dashboard" className="text-xs text-white/30 hover:text-white/60 transition-colors">← Dashboard</Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">Agenda</h1>
          <p className="text-white/40 text-sm mt-0.5">Aulas com {professor.nome_completo || "seu professor"}</p>
        </div>

        {/* Slots disponíveis */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-white">Horários disponíveis — próximas 4 semanas</h2>

          {porData.length === 0 ? (
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-8 text-center">
              <p className="text-white/40 text-sm">Nenhum horário disponível no momento.</p>
              <p className="text-white/25 text-xs mt-1">Seu professor ainda não configurou a agenda.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {porData.map(([dataKey, slots]) => (
                <div key={dataKey}>
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2 capitalize">
                    {formatarDataHeader(slots[0].data_hora_inicio)}
                  </p>
                  <div className="space-y-2">
                    {slots.map((slot) => (
                      <button
                        key={slot.data_hora_inicio}
                        disabled={slot.ocupado}
                        onClick={() => !slot.ocupado && setModal({ slot, step: "form", obs: "", agendamentoId: null })}
                        className={`w-full text-left rounded-2xl border px-5 py-4 transition-colors flex items-center justify-between gap-4 ${
                          slot.ocupado
                            ? "border-white/[0.05] bg-white/[0.02] opacity-40 cursor-not-allowed"
                            : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20 cursor-pointer"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-medium ${
                            slot.tipo === "presencial"
                              ? "border-blue-400/25 bg-blue-400/10 text-blue-300"
                              : "border-purple-400/25 bg-purple-400/10 text-purple-300"
                          }`}>
                            {slot.tipo === "presencial" ? "Presencial" : "Online"}
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {formatarHoraBR(slot.data_hora_inicio)} – {formatarHoraBR(slot.data_hora_fim)}
                            </p>
                            <p className="text-xs text-white/40 mt-0.5">{formatarValor(slot.valor, slot.moeda)}</p>
                          </div>
                        </div>
                        {slot.ocupado ? (
                          <span className="text-xs text-white/30 shrink-0">Ocupado</span>
                        ) : (
                          <span className="text-xs text-white/50 shrink-0">Agendar →</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Meus agendamentos */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-white">Meus agendamentos</h2>
          {agendamentos.length === 0 ? (
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6 text-center">
              <p className="text-white/40 text-sm">Nenhum agendamento futuro.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] divide-y divide-white/[0.06]">
              {agendamentos.map((ag) => {
                const st = STATUS_INFO[ag.status] ?? { label: ag.status, cls: "text-white/40" };
                const whatsapp = ag.professor?.whatsapp;
                return (
                  <div key={ag.id} className="px-5 py-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-white">
                            {formatarDataHoraBR(ag.data_hora_inicio)}
                          </p>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${st.cls}`}>
                            {st.label}
                          </span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                            ag.tipo === "presencial"
                              ? "border-blue-400/25 bg-blue-400/10 text-blue-300"
                              : "border-purple-400/25 bg-purple-400/10 text-purple-300"
                          }`}>
                            {ag.tipo}
                          </span>
                        </div>
                        {ag.valor_cobrado && (
                          <p className="text-xs text-white/40 mt-0.5">{formatarValor(ag.valor_cobrado)}</p>
                        )}
                        {ag.observacao && (
                          <p className="text-xs text-white/30 mt-0.5 italic">"{ag.observacao}"</p>
                        )}
                      </div>
                    </div>

                    {/* Botões de ação por status */}
                    <div className="flex flex-wrap gap-2">
                      {ag.status === "aguardando_pagamento" && (
                        <button
                          onClick={() => setModal({
                            slot: {
                              disponibilidade_id: "",
                              data_hora_inicio: ag.data_hora_inicio,
                              data_hora_fim: ag.data_hora_fim,
                              tipo: ag.tipo,
                              valor: ag.valor_cobrado,
                              moeda: "BRL",
                            },
                            step: "pix",
                            obs: ag.observacao ?? "",
                            agendamentoId: ag.id,
                          })}
                          className="rounded-xl bg-white px-4 py-1.5 text-xs font-semibold text-black hover:bg-white/90 transition-colors"
                        >
                          Ver dados do Pix
                        </button>
                      )}

                      {ag.status === "cancelado_professor" && whatsapp && (
                        <a
                          href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-400/15 transition-colors"
                        >
                          Reagendar via WhatsApp
                        </a>
                      )}

                      {(ag.status === "aguardando_pagamento" || ag.status === "confirmado") && (
                        <button
                          onClick={() => handleCancelar(ag.id, ag.data_hora_inicio)}
                          className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-400/15 transition-colors"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ── Modal de agendamento ──────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-[200] p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-sm">

            {modal.step === "form" ? (
              /* Etapa 1: confirmar e preencher observação */
              <div className="p-6 space-y-5">
                <h3 className="text-base font-semibold text-white">Confirmar agendamento</h3>

                <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/50">Data e hora</span>
                    <span className="text-white font-medium">{formatarDataHoraBR(modal.slot.data_hora_inicio)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/50">Tipo</span>
                    <span className="text-white capitalize">{modal.slot.tipo}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/50">Valor</span>
                    <span className="text-white font-semibold">{formatarValor(modal.slot.valor)}</span>
                  </div>
                </div>

                {modal.slot.valor !== null && professor && (
                  <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.05] px-4 py-3 space-y-1">
                    <p className="text-xs text-amber-400 font-medium">Pagamento via Pix</p>
                    <p className="text-xs text-white/60">
                      {professor.tipo_chave_pix && <span className="capitalize">{professor.tipo_chave_pix}: </span>}
                      <span className="font-mono text-white">{professor.chave_pix || "—"}</span>
                    </p>
                    <p className="text-xs text-white/40">Após confirmar, você verá os detalhes do Pix e poderá informar o pagamento.</p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs text-white/50 font-medium">Observação (opcional)</label>
                  <textarea
                    value={modal.obs}
                    onChange={(e) => setModal((m) => m ? { ...m, obs: e.target.value } : m)}
                    placeholder="Ex: Foco em perna, tenho lesão no ombro..."
                    rows={2}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 resize-none"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setModal(null)}
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-white/70 hover:bg-white/10 transition-colors"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={handleAgendar}
                    disabled={submitting}
                    className="flex-1 rounded-xl bg-white py-2.5 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-50 transition-colors"
                  >
                    {submitting
                      ? "Aguarde…"
                      : modal.slot.valor === null
                      ? "Confirmar agendamento"
                      : "Confirmar e pagar via Pix"}
                  </button>
                </div>
              </div>
            ) : (
              /* Etapa 2: dados do Pix + informar pagamento */
              <div className="p-6 space-y-5">
                <div>
                  <p className="text-xs text-white/40 mb-1">Agendamento criado</p>
                  <h3 className="text-base font-semibold text-white">Realize o Pix</h3>
                </div>

                <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/50">Aula</span>
                    <span className="text-white">{formatarDataHoraBR(modal.slot.data_hora_inicio)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/50">Valor</span>
                    <span className="text-white font-bold text-base">{formatarValor(modal.slot.valor)}</span>
                  </div>
                </div>

                {professor && (
                  <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] px-4 py-4 space-y-2">
                    <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wide">Chave Pix</p>
                    {professor.tipo_chave_pix && (
                      <p className="text-xs text-white/50 capitalize">{professor.tipo_chave_pix}</p>
                    )}
                    <p className="font-mono text-white text-sm break-all select-all">{professor.chave_pix || "—"}</p>
                  </div>
                )}

                <p className="text-xs text-white/40 text-center">
                  Após realizar o Pix, clique em "Já fiz o Pix" para notificar seu professor.
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() => { setModal(null); carregar(alunoId!); }}
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-white/70 hover:bg-white/10 transition-colors"
                  >
                    Fazer depois
                  </button>
                  <button
                    onClick={handleInformarPix}
                    disabled={submitting}
                    className="flex-1 rounded-xl bg-white py-2.5 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-50 transition-colors"
                  >
                    {submitting ? "Aguarde…" : "Já fiz o Pix"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Confirm cancelar ─────────────────────────────────────────────── */}
      {confirmCancelar && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[300] p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-6 max-w-sm w-full">
            <p className="text-white text-sm">{confirmCancelar.msg}</p>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setConfirmCancelar(null)} className="border border-white/10 bg-white/5 px-4 py-2 rounded-xl text-sm text-white/70 hover:bg-white/10 transition-colors">
                Voltar
              </button>
              <button
                onClick={() => { confirmCancelar.onOk(); setConfirmCancelar(null); }}
                className="bg-white text-black px-4 py-2 rounded-xl text-sm font-semibold hover:bg-white/90 transition-colors"
              >
                Cancelar aula
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toasts ───────────────────────────────────────────────────────── */}
      {toasts.length > 0 && (
        <div className="fixed bottom-24 right-4 z-[100] flex flex-col gap-2 max-w-sm">
          {toasts.map((t) => (
            <div key={t.id} className={`rounded-xl px-4 py-3 text-sm font-medium shadow-xl border ${
              t.kind === "ok" ? "bg-white text-black border-transparent" : "bg-red-500/10 text-red-200 border-red-500/20"
            }`}>
              {t.msg}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
