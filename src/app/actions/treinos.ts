"use server";

import { supabaseAdmin } from "@/utils/supabaseAdmin";
import { criarNotificacao } from "@/lib/criarNotificacao";

export type AtribuirTreinoResult =
  | { ok: true }
  | { ok: false; error: string };

export async function atribuirTreinoAoAluno(
  treinoId: string,
  alunoId: string,
  profId: string
): Promise<AtribuirTreinoResult> {
  const { error: updErr } = await supabaseAdmin
    .from("treinos")
    .update({ aluno_id: alunoId })
    .eq("id", treinoId)
    .eq("professor_id", profId);

  if (updErr) return { ok: false, error: updErr.message };

  try {
    const [{ data: prof }, { data: treino }] = await Promise.all([
      supabaseAdmin.from("profiles").select("nome_completo").eq("id", profId).single(),
      supabaseAdmin.from("treinos").select("nome").eq("id", treinoId).single(),
    ]);

    await criarNotificacao({
      destinatario_id: alunoId,
      tipo: "treino_novo",
      titulo: "Você tem um novo treino!",
      mensagem: `${prof?.nome_completo || "Seu professor"} criou um novo plano de treino para você`,
      referencia_id: treinoId,
      referencia_tipo: "treino",
    });
  } catch { /* notificação é best-effort */ }

  return { ok: true };
}
