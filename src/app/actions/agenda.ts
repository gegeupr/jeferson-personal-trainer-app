"use server";

import { supabaseAdmin } from "@/utils/supabaseAdmin";
import { criarNotificacao } from "@/lib/criarNotificacao";
import type { DisponibilidadeSlot } from "@/lib/agenda-utils";

// ── Tipos exportados ──────────────────────────────────────────────────────────

export type AgendamentoComPartes = {
  id: string;
  professor_id: string;
  aluno_id: string;
  data_hora_inicio: string;
  data_hora_fim: string;
  tipo: "presencial" | "online";
  status: string;
  observacao: string | null;
  valor_cobrado: number | null;
  created_at: string;
  aluno?: { nome_completo: string | null } | null;
  professor?: { nome_completo: string | null; whatsapp: string | null } | null;
};

type ActionResult = { ok: true } | { ok: false; error: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatarDataHoraNotif(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

// ── Disponibilidade ───────────────────────────────────────────────────────────

export async function adicionarSlotDisponibilidade(
  profId: string,
  slot: {
    dia_semana: number;
    hora_inicio: string;
    hora_fim: string;
    tipo: "presencial" | "online";
    valor: number | null;
  }
): Promise<ActionResult> {
  const { error } = await supabaseAdmin.from("professor_disponibilidade").insert({
    professor_id: profId,
    dia_semana: slot.dia_semana,
    hora_inicio: slot.hora_inicio,
    hora_fim: slot.hora_fim,
    tipo: slot.tipo,
    valor: slot.valor ?? null,
    moeda: "BRL",
    ativo: true,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function removerSlotDisponibilidade(
  slotId: string,
  profId: string
): Promise<ActionResult> {
  const { error } = await supabaseAdmin
    .from("professor_disponibilidade")
    .delete()
    .eq("id", slotId)
    .eq("professor_id", profId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function buscarDisponibilidadeEOcupados(profId: string): Promise<{
  disponibilidade: DisponibilidadeSlot[];
  ocupados: string[];
}> {
  const agora = new Date().toISOString();
  const em4Semanas = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString();

  const [dispResult, ocupResult] = await Promise.all([
    supabaseAdmin
      .from("professor_disponibilidade")
      .select("id, dia_semana, hora_inicio, hora_fim, tipo, valor, moeda, ativo")
      .eq("professor_id", profId)
      .eq("ativo", true)
      .order("dia_semana")
      .order("hora_inicio"),

    supabaseAdmin
      .from("agendamentos")
      .select("data_hora_inicio")
      .eq("professor_id", profId)
      .in("status", ["aguardando_pagamento", "pagamento_informado", "confirmado"])
      .gte("data_hora_inicio", agora)
      .lte("data_hora_inicio", em4Semanas),
  ]);

  return {
    disponibilidade: (dispResult.data ?? []) as DisponibilidadeSlot[],
    ocupados: (ocupResult.data ?? []).map((r) => r.data_hora_inicio),
  };
}

export async function buscarDisponibilidadeProfessor(profId: string): Promise<DisponibilidadeSlot[]> {
  const { data } = await supabaseAdmin
    .from("professor_disponibilidade")
    .select("id, dia_semana, hora_inicio, hora_fim, tipo, valor, moeda, ativo")
    .eq("professor_id", profId)
    .order("dia_semana")
    .order("hora_inicio");
  return (data ?? []) as DisponibilidadeSlot[];
}

// ── Agendamentos ──────────────────────────────────────────────────────────────

export async function criarAgendamento(params: {
  profId: string;
  alunoId: string;
  dataHoraInicio: string;
  dataHoraFim: string;
  tipo: "presencial" | "online";
  observacao?: string;
  valorCobrado: number | null;
}): Promise<{ ok: true; agendamentoId: string } | { ok: false; error: string }> {
  const statusInicial = params.valorCobrado === null ? "confirmado" : "aguardando_pagamento";

  const { data, error } = await supabaseAdmin
    .from("agendamentos")
    .insert({
      professor_id: params.profId,
      aluno_id: params.alunoId,
      data_hora_inicio: params.dataHoraInicio,
      data_hora_fim: params.dataHoraFim,
      tipo: params.tipo,
      status: statusInicial,
      observacao: params.observacao ?? null,
      valor_cobrado: params.valorCobrado,
    })
    .select("id")
    .single();

  if (error) {
    // Código 23505 = violação de unique constraint (slot já ocupado)
    if (error.code === "23505") {
      return { ok: false, error: "Este horário foi reservado por outro aluno. Escolha outro." };
    }
    return { ok: false, error: error.message };
  }

  const dataHoraFormatada = formatarDataHoraNotif(params.dataHoraInicio);

  try {
    const { data: aluno } = await supabaseAdmin
      .from("profiles").select("nome_completo").eq("id", params.alunoId).single();
    const nomeAluno = aluno?.nome_completo || "Um aluno";
    const tipoLabel = params.tipo === "presencial" ? "presencial" : "online";

    await criarNotificacao({
      destinatario_id: params.profId,
      tipo: "aula_agendada",
      titulo: "Nova aula agendada!",
      mensagem: `${nomeAluno} agendou uma aula ${tipoLabel} para ${dataHoraFormatada}`,
      referencia_id: data.id,
      referencia_tipo: "agendamento",
    });
  } catch { /* best-effort */ }

  return { ok: true, agendamentoId: data.id };
}

export async function informarPagamento(
  agendamentoId: string,
  alunoId: string
): Promise<ActionResult> {
  const { data: ag, error: fetchErr } = await supabaseAdmin
    .from("agendamentos")
    .select("professor_id, aluno_id, data_hora_inicio, valor_cobrado")
    .eq("id", agendamentoId)
    .eq("aluno_id", alunoId)
    .eq("status", "aguardando_pagamento")
    .single();

  if (fetchErr || !ag) return { ok: false, error: "Agendamento não encontrado." };

  const { error } = await supabaseAdmin
    .from("agendamentos")
    .update({ status: "pagamento_informado" })
    .eq("id", agendamentoId);

  if (error) return { ok: false, error: error.message };

  try {
    const { data: aluno } = await supabaseAdmin
      .from("profiles").select("nome_completo").eq("id", alunoId).single();
    const nomeAluno = aluno?.nome_completo || "Um aluno";
    const dataHoraFormatada = formatarDataHoraNotif(ag.data_hora_inicio);
    const valorStr = ag.valor_cobrado
      ? `R$ ${Number(ag.valor_cobrado).toFixed(2).replace(".", ",")}`
      : "";

    await criarNotificacao({
      destinatario_id: ag.professor_id,
      tipo: "pagamento_informado",
      titulo: "Pagamento informado",
      mensagem: `${nomeAluno} informou pagamento da aula de ${dataHoraFormatada}${valorStr ? ` — ${valorStr}` : ""}. Confirme após verificar o recebimento.`,
      referencia_id: agendamentoId,
      referencia_tipo: "agendamento",
    });
  } catch { /* best-effort */ }

  return { ok: true };
}

export async function confirmarRecebimento(
  agendamentoId: string,
  profId: string
): Promise<ActionResult> {
  const { data: ag, error: fetchErr } = await supabaseAdmin
    .from("agendamentos")
    .select("aluno_id, data_hora_inicio")
    .eq("id", agendamentoId)
    .eq("professor_id", profId)
    .eq("status", "pagamento_informado")
    .single();

  if (fetchErr || !ag) return { ok: false, error: "Agendamento não encontrado." };

  const { error } = await supabaseAdmin
    .from("agendamentos")
    .update({ status: "confirmado" })
    .eq("id", agendamentoId);

  if (error) return { ok: false, error: error.message };

  try {
    await criarNotificacao({
      destinatario_id: ag.aluno_id,
      tipo: "aula_confirmada",
      titulo: "Aula confirmada!",
      mensagem: `Seu professor confirmou o recebimento do Pix! Aula de ${formatarDataHoraNotif(ag.data_hora_inicio)} confirmada.`,
      referencia_id: agendamentoId,
      referencia_tipo: "agendamento",
    });
  } catch { /* best-effort */ }

  return { ok: true };
}

export async function recusarPagamento(
  agendamentoId: string,
  profId: string
): Promise<ActionResult> {
  const { data: ag, error: fetchErr } = await supabaseAdmin
    .from("agendamentos")
    .select("aluno_id, data_hora_inicio")
    .eq("id", agendamentoId)
    .eq("professor_id", profId)
    .eq("status", "pagamento_informado")
    .single();

  if (fetchErr || !ag) return { ok: false, error: "Agendamento não encontrado." };

  const { error } = await supabaseAdmin
    .from("agendamentos")
    .update({ status: "cancelado_professor" })
    .eq("id", agendamentoId);

  if (error) return { ok: false, error: error.message };

  try {
    await criarNotificacao({
      destinatario_id: ag.aluno_id,
      tipo: "aula_recusada",
      titulo: "Pagamento não confirmado",
      mensagem: `Seu professor não confirmou o pagamento da aula de ${formatarDataHoraNotif(ag.data_hora_inicio)}. Entre em contato pelo WhatsApp.`,
      referencia_id: agendamentoId,
      referencia_tipo: "agendamento",
    });
  } catch { /* best-effort */ }

  return { ok: true };
}

export async function cancelarAgendamento(
  agendamentoId: string,
  canceladoPor: "professor" | "aluno",
  userId: string
): Promise<ActionResult> {
  const novoStatus = canceladoPor === "professor" ? "cancelado_professor" : "cancelado_aluno";
  const filtroId = canceladoPor === "professor" ? "professor_id" : "aluno_id";

  const { data: ag, error: fetchErr } = await supabaseAdmin
    .from("agendamentos")
    .select("professor_id, aluno_id, data_hora_inicio, tipo")
    .eq("id", agendamentoId)
    .eq(filtroId, userId)
    .in("status", ["aguardando_pagamento", "pagamento_informado", "confirmado"])
    .single();

  if (fetchErr || !ag) return { ok: false, error: "Agendamento não encontrado." };

  const { error } = await supabaseAdmin
    .from("agendamentos")
    .update({ status: novoStatus })
    .eq("id", agendamentoId);

  if (error) return { ok: false, error: error.message };

  const dataHoraFormatada = formatarDataHoraNotif(ag.data_hora_inicio);

  try {
    if (canceladoPor === "professor") {
      await criarNotificacao({
        destinatario_id: ag.aluno_id,
        tipo: "aula_cancelada_professor",
        titulo: "Aula cancelada pelo professor",
        mensagem: `Seu professor cancelou a aula de ${dataHoraFormatada}. Entre em contato pelo WhatsApp para reagendar.`,
        referencia_id: agendamentoId,
        referencia_tipo: "agendamento",
      });
    } else {
      const { data: aluno } = await supabaseAdmin
        .from("profiles").select("nome_completo").eq("id", userId).single();
      const nomeAluno = aluno?.nome_completo || "Um aluno";
      await criarNotificacao({
        destinatario_id: ag.professor_id,
        tipo: "aula_cancelada_aluno",
        titulo: "Aula cancelada pelo aluno",
        mensagem: `${nomeAluno} cancelou a aula de ${dataHoraFormatada}.`,
        referencia_id: agendamentoId,
        referencia_tipo: "agendamento",
      });
    }
  } catch { /* best-effort */ }

  return { ok: true };
}

// ── Listagens ─────────────────────────────────────────────────────────────────

export async function buscarAgendamentosProfessor(
  profId: string,
  dias = 30
): Promise<AgendamentoComPartes[]> {
  const agora = new Date().toISOString();
  const limite = new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabaseAdmin
    .from("agendamentos")
    .select("*, aluno:profiles!aluno_id(nome_completo)")
    .eq("professor_id", profId)
    .gte("data_hora_inicio", agora)
    .lte("data_hora_inicio", limite)
    .order("data_hora_inicio");

  return (data ?? []) as AgendamentoComPartes[];
}

export async function buscarAgendamentosAluno(
  alunoId: string
): Promise<AgendamentoComPartes[]> {
  const agora = new Date().toISOString();

  const { data } = await supabaseAdmin
    .from("agendamentos")
    .select("*, professor:profiles!professor_id(nome_completo, whatsapp)")
    .eq("aluno_id", alunoId)
    .gte("data_hora_inicio", agora)
    .order("data_hora_inicio");

  return (data ?? []) as AgendamentoComPartes[];
}

export async function buscarProximasAulasProfessor(
  profId: string,
  limite = 3
): Promise<AgendamentoComPartes[]> {
  const agora = new Date().toISOString();

  const { data } = await supabaseAdmin
    .from("agendamentos")
    .select("*, aluno:profiles!aluno_id(nome_completo)")
    .eq("professor_id", profId)
    .eq("status", "confirmado")
    .gte("data_hora_inicio", agora)
    .order("data_hora_inicio")
    .limit(limite);

  return (data ?? []) as AgendamentoComPartes[];
}

export async function buscarPendentesConfirmacao(profId: string): Promise<AgendamentoComPartes[]> {
  const { data } = await supabaseAdmin
    .from("agendamentos")
    .select("*, aluno:profiles!aluno_id(nome_completo)")
    .eq("professor_id", profId)
    .eq("status", "pagamento_informado")
    .order("created_at");

  return (data ?? []) as AgendamentoComPartes[];
}

export type ProfessorAgendaInfo = {
  id: string;
  nome_completo: string | null;
  chave_pix: string | null;
  tipo_chave_pix: string | null;
  whatsapp: string | null;
};

export async function buscarAgendaAluno(alunoId: string): Promise<{
  professor: ProfessorAgendaInfo | null;
  disponibilidade: DisponibilidadeSlot[];
  ocupados: string[];
  agendamentos: AgendamentoComPartes[];
}> {
  const vazio = { professor: null, disponibilidade: [], ocupados: [], agendamentos: [] };

  // Busca professor_id do aluno
  const { data: perfil } = await supabaseAdmin
    .from("profiles")
    .select("professor_id")
    .eq("id", alunoId)
    .single();

  const profId = perfil?.professor_id;
  if (!profId) return vazio;

  const agora = new Date().toISOString();
  const em4Semanas = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString();

  const [profResult, dispResult, ocupResult, agResult] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, nome_completo, chave_pix, tipo_chave_pix, whatsapp")
      .eq("id", profId)
      .single(),

    supabaseAdmin
      .from("professor_disponibilidade")
      .select("id, dia_semana, hora_inicio, hora_fim, tipo, valor, moeda, ativo")
      .eq("professor_id", profId)
      .eq("ativo", true)
      .order("dia_semana")
      .order("hora_inicio"),

    supabaseAdmin
      .from("agendamentos")
      .select("data_hora_inicio")
      .eq("professor_id", profId)
      .in("status", ["aguardando_pagamento", "pagamento_informado", "confirmado"])
      .gte("data_hora_inicio", agora)
      .lte("data_hora_inicio", em4Semanas),

    supabaseAdmin
      .from("agendamentos")
      .select("*, professor:profiles!professor_id(nome_completo, whatsapp)")
      .eq("aluno_id", alunoId)
      .gte("data_hora_inicio", agora)
      .order("data_hora_inicio"),
  ]);

  return {
    professor: (profResult.data as ProfessorAgendaInfo) ?? null,
    disponibilidade: (dispResult.data ?? []) as DisponibilidadeSlot[],
    ocupados: (ocupResult.data ?? []).map((r) => r.data_hora_inicio),
    agendamentos: (agResult.data ?? []) as AgendamentoComPartes[],
  };
}
