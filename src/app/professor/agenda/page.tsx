"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase-browser";
import {
  adicionarSlotDisponibilidade,
  removerSlotDisponibilidade,
  buscarDisponibilidadeProfessor,
  buscarPendentesConfirmacao,
  buscarAgendamentosProfessor,
  confirmarRecebimento,
  recusarPagamento,
  cancelarAgendamento,
  type AgendamentoComPartes,
} from "@/app/actions/agenda";
import {
  nomeDiaSemana,
  formatarDataHoraBR,
  formatarValor,
  type DisponibilidadeSlot,
} from "@/lib/agenda-utils";

// ── Ícones ────────────────────────────────────────────────────────────────────

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
    </svg>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DIAS_SEMANA = [
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  confirmado:           { label: "Confirmado",     cls: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
  aguardando_pagamento: { label: "Aguard. Pix",    cls: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
  pagamento_informado:  { label: "Pix informado",  cls: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
  cancelado_professor:  { label: "Cancelado",      cls: "text-red-400 bg-red-400/10 border-red-400/20" },
  cancelado_aluno:      { label: "Cancelado",      cls: "text-red-400 bg-red-400/10 border-red-400/20" },
};

type FormState = {
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  tipo: "presencial" | "online";
  gratuito: boolean;
  valor: string;
};

const FORM_INICIAL: FormState = {
  dia_semana: 1,
  hora_inicio: "08:00",
  hora_fim: "09:00",
  tipo: "presencial",
  gratuito: false,
  valor: "",
};

// ── Componente ────────────────────────────────────────────────────────────────

export default function ProfessorAgendaPage() {
  const router = useRouter();
  const [profId, setProfId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [disponibilidade, setDisponibilidade] = useState<DisponibilidadeSlot[]>([]);
  const [pendentes, setPendentes] = useState<AgendamentoComPartes[]>([]);
  const [proximas, setProximas] = useState<AgendamentoComPartes[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FormState>(FORM_INICIAL);
  const [salvando, setSalvando] = useState(false);

  const [submitting, setSubmitting] = useState<string | null>(null);
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: "ok" | "err" }[]>([]);
  const [confirm, setConfirm] = useState<{ msg: string; onOk: () => void } | null>(null);

  function toast(msg: string, kind: "ok" | "err") {
    const id = Date.now();
    setToasts((p) => [...p, { id, msg, kind }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
  }

  const carregar = useCallback(async (pid: string) => {
    const [disp, pend, prox] = await Promise.all([
      buscarDisponibilidadeProfessor(pid),
      buscarPendentesConfirmacao(pid),
      buscarAgendamentosProfessor(pid, 30),
    ]);
    setDisponibilidade(disp);
    setPendentes(pend);
    setProximas(prox);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      setProfId(user.id);
      carregar(user.id).finally(() => setLoading(false));
    });
  }, [router, carregar]);

  // ── Disponibilidade ────────────────────────────────────────────────────────

  async function handleAdicionarSlot() {
    if (!profId) return;
    if (form.hora_fim <= form.hora_inicio) {
      toast("Hora fim deve ser após hora início.", "err");
      return;
    }
    setSalvando(true);
    const result = await adicionarSlotDisponibilidade(profId, {
      dia_semana: form.dia_semana,
      hora_inicio: form.hora_inicio,
      hora_fim: form.hora_fim,
      tipo: form.tipo,
      valor: form.gratuito ? null : form.valor ? Number(form.valor) : null,
    });
    setSalvando(false);
    if (!result.ok) { toast("Erro ao salvar: " + result.error, "err"); return; }
    toast("Horário adicionado!", "ok");
    setShowModal(false);
    setForm(FORM_INICIAL);
    carregar(profId);
  }

  async function handleRemoverSlot(slotId: string) {
    if (!profId) return;
    setConfirm({
      msg: "Remover este horário da disponibilidade? Agendamentos já confirmados não são afetados.",
      onOk: async () => {
        setSubmitting(slotId);
        const r = await removerSlotDisponibilidade(slotId, profId);
        setSubmitting(null);
        if (!r.ok) { toast("Erro: " + r.error, "err"); return; }
        toast("Horário removido.", "ok");
        carregar(profId);
      },
    });
  }

  // ── Pendentes ──────────────────────────────────────────────────────────────

  async function handleConfirmar(agId: string) {
    if (!profId) return;
    setSubmitting(agId);
    const r = await confirmarRecebimento(agId, profId);
    setSubmitting(null);
    if (!r.ok) { toast("Erro: " + r.error, "err"); return; }
    toast("Pagamento confirmado! Aula marcada.", "ok");
    carregar(profId);
  }

  async function handleRecusar(agId: string) {
    if (!profId) return;
    setConfirm({
      msg: "Recusar este pagamento? O agendamento será cancelado e o aluno será notificado.",
      onOk: async () => {
        setSubmitting(agId);
        const r = await recusarPagamento(agId, profId);
        setSubmitting(null);
        if (!r.ok) { toast("Erro: " + r.error, "err"); return; }
        toast("Pagamento recusado.", "ok");
        carregar(profId);
      },
    });
  }

  async function handleCancelar(agId: string) {
    if (!profId) return;
    setConfirm({
      msg: "Cancelar esta aula? O aluno será notificado.",
      onOk: async () => {
        setSubmitting(agId);
        const r = await cancelarAgendamento(agId, "professor", profId);
        setSubmitting(null);
        if (!r.ok) { toast("Erro: " + r.error, "err"); return; }
        toast("Aula cancelada.", "ok");
        carregar(profId);
      },
    });
  }

  // ── Agrupamento de slots por dia ──────────────────────────────────────────

  const slotsPorDia = DIAS_SEMANA
    .map((d) => ({ ...d, slots: disponibilidade.filter((s) => s.dia_semana === d.value) }))
    .filter((d) => d.slots.length > 0);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-white/40 text-sm">Carregando agenda…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/40 text-sm">Professor</p>
            <h1 className="text-2xl font-bold tracking-tight">Agenda</h1>
          </div>
          <button
            onClick={() => { setForm(FORM_INICIAL); setShowModal(true); }}
            className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 transition-colors"
          >
            <IconPlus /> Adicionar horário
          </button>
        </div>

        {/* Pendentes de confirmação */}
        {pendentes.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-white">Aguardando confirmação de pagamento</h2>
              <span className="rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-400 text-[10px] font-bold px-2 py-0.5">
                {pendentes.length}
              </span>
            </div>
            <div className="rounded-2xl border border-amber-400/15 bg-amber-400/[0.04] divide-y divide-white/[0.06]">
              {pendentes.map((ag) => (
                <div key={ag.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">
                      {ag.aluno?.nome_completo || "Aluno"}
                    </p>
                    <p className="text-xs text-white/50 mt-0.5">
                      {formatarDataHoraBR(ag.data_hora_inicio)} · {ag.tipo}
                      {ag.valor_cobrado ? ` · ${formatarValor(ag.valor_cobrado)}` : ""}
                    </p>
                    {ag.observacao && (
                      <p className="text-xs text-white/35 mt-0.5 italic">"{ag.observacao}"</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleConfirmar(ag.id)}
                      disabled={submitting === ag.id}
                      className="rounded-xl bg-white px-4 py-1.5 text-xs font-semibold text-black hover:bg-white/90 disabled:opacity-40 transition-colors"
                    >
                      Confirmar recebimento
                    </button>
                    <button
                      onClick={() => handleRecusar(ag.id)}
                      disabled={submitting === ag.id}
                      className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-400/15 disabled:opacity-40 transition-colors"
                    >
                      Recusar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Disponibilidade semanal */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-white">Disponibilidade semanal</h2>
          {slotsPorDia.length === 0 ? (
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-8 text-center">
              <p className="text-white/40 text-sm">Nenhum horário cadastrado.</p>
              <p className="text-white/25 text-xs mt-1">Clique em "Adicionar horário" para começar.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {slotsPorDia.map((dia) => (
                <div key={dia.value} className="rounded-2xl border border-white/8 bg-white/[0.03]">
                  <p className="px-5 pt-4 pb-2 text-xs font-semibold text-white/50 uppercase tracking-wider">
                    {dia.label}
                  </p>
                  <div className="divide-y divide-white/[0.06]">
                    {dia.slots.map((slot) => (
                      <div key={slot.id} className="px-5 py-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <span className={`shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-medium ${
                            slot.tipo === "presencial"
                              ? "border-blue-400/25 bg-blue-400/10 text-blue-300"
                              : "border-purple-400/25 bg-purple-400/10 text-purple-300"
                          }`}>
                            {slot.tipo === "presencial" ? "Presencial" : "Online"}
                          </span>
                          <div>
                            <p className="text-sm text-white font-medium">
                              {slot.hora_inicio.slice(0, 5)} – {slot.hora_fim.slice(0, 5)}
                            </p>
                            <p className="text-xs text-white/40">
                              {formatarValor(slot.valor, slot.moeda)}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoverSlot(slot.id)}
                          disabled={submitting === slot.id}
                          className="flex items-center justify-center h-7 w-7 rounded-lg border border-white/10 text-white/30 hover:text-red-300 hover:border-red-400/30 hover:bg-red-400/10 disabled:opacity-40 transition-colors"
                          aria-label="Remover horário"
                        >
                          <IconTrash />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Próximas aulas */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-white">Próximas aulas (30 dias)</h2>
          {proximas.length === 0 ? (
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6 text-center">
              <p className="text-white/40 text-sm">Nenhuma aula agendada.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] divide-y divide-white/[0.06]">
              {proximas.map((ag) => {
                const st = STATUS_LABEL[ag.status] ?? { label: ag.status, cls: "text-white/40" };
                return (
                  <div key={ag.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-white">
                          {ag.aluno?.nome_completo || "Aluno"}
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
                      <p className="text-xs text-white/50 mt-0.5">
                        {formatarDataHoraBR(ag.data_hora_inicio)}
                        {ag.valor_cobrado ? ` · ${formatarValor(ag.valor_cobrado)}` : ""}
                      </p>
                      {ag.observacao && (
                        <p className="text-xs text-white/35 mt-0.5 italic">"{ag.observacao}"</p>
                      )}
                    </div>
                    {(ag.status === "confirmado" || ag.status === "aguardando_pagamento") && (
                      <button
                        onClick={() => handleCancelar(ag.id)}
                        disabled={submitting === ag.id}
                        className="shrink-0 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-400/15 disabled:opacity-40 transition-colors"
                      >
                        Cancelar aula
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ── Modal adicionar horário ──────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-5">
            <h3 className="text-base font-semibold text-white">Adicionar horário</h3>

            {/* Dia da semana */}
            <div className="space-y-1.5">
              <label className="text-xs text-white/50 font-medium">Dia da semana</label>
              <select
                value={form.dia_semana}
                onChange={(e) => setForm((f) => ({ ...f, dia_semana: Number(e.target.value) }))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
              >
                {DIAS_SEMANA.map((d) => (
                  <option key={d.value} value={d.value} className="bg-[#111]">{d.label}</option>
                ))}
              </select>
            </div>

            {/* Horários */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs text-white/50 font-medium">Início</label>
                <input
                  type="time"
                  value={form.hora_inicio}
                  onChange={(e) => setForm((f) => ({ ...f, hora_inicio: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-white/50 font-medium">Fim</label>
                <input
                  type="time"
                  value={form.hora_fim}
                  onChange={(e) => setForm((f) => ({ ...f, hora_fim: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
                />
              </div>
            </div>

            {/* Tipo */}
            <div className="space-y-1.5">
              <label className="text-xs text-white/50 font-medium">Tipo de aula</label>
              <div className="grid grid-cols-2 gap-2">
                {(["presencial", "online"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, tipo: t }))}
                    className={`rounded-xl border py-2 text-sm font-medium transition-colors capitalize ${
                      form.tipo === t
                        ? "border-white/40 bg-white/10 text-white"
                        : "border-white/10 bg-white/[0.03] text-white/40 hover:text-white/70"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Valor */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs text-white/50 font-medium">Valor (R$)</label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.gratuito}
                    onChange={(e) => setForm((f) => ({ ...f, gratuito: e.target.checked, valor: "" }))}
                    className="rounded"
                  />
                  <span className="text-xs text-white/40">Gratuito / pacote</span>
                </label>
              </div>
              {!form.gratuito && (
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="ex: 150.00"
                  value={form.valor}
                  onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30"
                />
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2 text-sm text-white/70 hover:bg-white/10 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAdicionarSlot}
                disabled={salvando}
                className="flex-1 rounded-xl bg-white py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-50 transition-colors"
              >
                {salvando ? "Salvando…" : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm dialog ───────────────────────────────────────────────── */}
      {confirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[300] p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-6 max-w-sm w-full">
            <p className="text-white text-sm">{confirm.msg}</p>
            <div className="flex gap-2 mt-5 justify-end">
              <button
                onClick={() => setConfirm(null)}
                className="border border-white/10 bg-white/5 px-4 py-2 rounded-xl text-sm text-white/70 hover:bg-white/10 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => { confirm.onOk(); setConfirm(null); }}
                className="bg-white text-black px-4 py-2 rounded-xl text-sm font-semibold hover:bg-white/90 transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toasts ───────────────────────────────────────────────────────── */}
      {toasts.length > 0 && (
        <div className="fixed bottom-24 lg:bottom-6 right-4 z-[100] flex flex-col gap-2 max-w-sm">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`rounded-xl px-4 py-3 text-sm font-medium shadow-xl border ${
                t.kind === "ok"
                  ? "bg-white text-black border-transparent"
                  : "bg-red-500/10 text-red-200 border-red-500/20"
              }`}
            >
              {t.msg}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
