"use server";

import { supabaseAdmin } from "@/utils/supabaseAdmin";

type Params = {
  destinatario_id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  referencia_id?: string;
  referencia_tipo?: string;
};

export async function criarNotificacao(p: Params): Promise<void> {
  const { error } = await supabaseAdmin.from("notificacoes").insert({
    destinatario_id: p.destinatario_id,
    tipo: p.tipo,
    titulo: p.titulo,
    mensagem: p.mensagem,
    referencia_id: p.referencia_id ?? null,
    referencia_tipo: p.referencia_tipo ?? null,
  });
  if (error) {
    console.error("[criarNotificacao] erro:", error.message);
  }
}

// Notifica professor quando aluno conclui rotina (e opcionalmente deixa feedback)
export async function notificarConcluidoTreino(params: {
  alunoId: string;
  profId: string;
  treinoId: string;
  nota: number | null;
  feedbackTexto: string | null;
}): Promise<void> {
  const { alunoId, profId, treinoId, nota, feedbackTexto } = params;

  const [{ data: aluno }, { data: treino }] = await Promise.all([
    supabaseAdmin.from("profiles").select("nome_completo").eq("id", alunoId).single(),
    supabaseAdmin.from("treinos").select("nome").eq("id", treinoId).single(),
  ]);

  const alunoNome = aluno?.nome_completo || "Um aluno";
  const treinoNome = treino?.nome || "o treino";

  await criarNotificacao({
    destinatario_id: profId,
    tipo: "treino_concluido",
    titulo: "Treino concluído!",
    mensagem: `${alunoNome} concluiu ${treinoNome}`,
    referencia_id: treinoId,
    referencia_tipo: "treino",
  });

  if (nota !== null) {
    await criarNotificacao({
      destinatario_id: profId,
      tipo: "feedback_recebido",
      titulo: "Novo feedback recebido",
      mensagem: `${alunoNome} avaliou o treino ${treinoNome} com nota ${nota}/5${feedbackTexto ? ` — "${feedbackTexto}"` : ""}`,
      referencia_id: treinoId,
      referencia_tipo: "treino",
    });
  }
}
