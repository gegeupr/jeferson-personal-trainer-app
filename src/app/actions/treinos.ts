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
    const { data: prof } = await supabaseAdmin
      .from("profiles").select("nome_completo").eq("id", profId).single();

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

export type DuplicarTreinoResult =
  | { ok: true; novoTreinoId: string; nome: string }
  | { ok: false; error: string };

export async function duplicarTreinoParaAluno(
  treinoId: string,
  alunoId: string,
  profId: string
): Promise<DuplicarTreinoResult> {
  try {
    const [origemResult, alunoResult] = await Promise.all([
      supabaseAdmin
        .from("treinos")
        .select("nome, descricao, tipo_treino, objetivo, dificuldade, orientacao_professor, gerado_por_ia, perfil_origem")
        .eq("id", treinoId)
        .eq("professor_id", profId)
        .single(),
      supabaseAdmin
        .from("profiles")
        .select("nome_completo")
        .eq("id", alunoId)
        .single(),
    ]);

    if (origemResult.error || !origemResult.data) throw new Error("Treino original não encontrado.");
    if (alunoResult.error || !alunoResult.data) throw new Error("Aluno não encontrado.");

    const origem = origemResult.data;
    const nomeAluno = alunoResult.data.nome_completo || "Aluno";
    const nomeCopia = `${origem.nome} — ${nomeAluno}`;

    const { data: novoTreino, error: treinoErr } = await supabaseAdmin
      .from("treinos")
      .insert({
        nome: nomeCopia,
        descricao: origem.descricao,
        aluno_id: alunoId,
        professor_id: profId,
        tipo_treino: origem.tipo_treino,
        objetivo: origem.objetivo,
        dificuldade: origem.dificuldade,
        orientacao_professor: origem.orientacao_professor,
        gerado_por_ia: origem.gerado_por_ia,
        is_template: false,
        perfil_origem: origem.perfil_origem,
        template_origem_id: treinoId,
      })
      .select("id")
      .single();

    if (treinoErr || !novoTreino)
      throw treinoErr ?? new Error("Erro ao criar cópia do treino.");

    const { data: rotinas, error: rotinasErr } = await supabaseAdmin
      .from("rotinas_diarias")
      .select("id, nome, descricao")
      .eq("plano_id", treinoId)
      .order("created_at");

    if (rotinasErr) throw rotinasErr;

    for (const rotina of rotinas ?? []) {
      const { data: novaRotina, error: novaRotinaErr } = await supabaseAdmin
        .from("rotinas_diarias")
        .insert({ plano_id: novoTreino.id, nome: rotina.nome, descricao: rotina.descricao, aluno_id: alunoId })
        .select("id")
        .single();

      if (novaRotinaErr || !novaRotina)
        throw novaRotinaErr ?? new Error(`Erro ao copiar rotina "${rotina.nome}".`);

      const { data: exercicios, error: exErr } = await supabaseAdmin
        .from("treino_exercicios")
        .select("exercicio_id, catalogo_id, ordem, series, repeticoes, intervalo, observacoes")
        .eq("rotina_id", rotina.id)
        .order("ordem");

      if (exErr) throw exErr;
      if (!exercicios || exercicios.length === 0) continue;

      const { error: insertErr } = await supabaseAdmin
        .from("treino_exercicios")
        .insert(
          exercicios.map((ex) => ({
            rotina_id: novaRotina.id,
            exercicio_id: ex.exercicio_id,
            catalogo_id: ex.catalogo_id,
            ordem: ex.ordem,
            series: ex.series,
            repeticoes: ex.repeticoes,
            intervalo: ex.intervalo,
            observacoes: ex.observacoes,
          }))
        );

      if (insertErr) throw insertErr;
    }

    try {
      const { data: prof } = await supabaseAdmin
        .from("profiles").select("nome_completo").eq("id", profId).single();
      await criarNotificacao({
        destinatario_id: alunoId,
        tipo: "treino_novo",
        titulo: "Você tem um novo treino!",
        mensagem: `${prof?.nome_completo || "Seu professor"} criou um novo plano de treino para você`,
        referencia_id: novoTreino.id,
        referencia_tipo: "treino",
      });
    } catch { /* notificação é best-effort */ }

    return { ok: true, novoTreinoId: novoTreino.id, nome: nomeCopia };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Erro ao duplicar treino." };
  }
}
