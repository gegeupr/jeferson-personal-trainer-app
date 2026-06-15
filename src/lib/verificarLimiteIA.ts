"use server";

import { supabaseAdmin } from "@/utils/supabaseAdmin";

const LIMITE_MENSAL_IA = 30;

export type UsoIA = { geracoes_usadas: number; limite: number };

export type VerificarLimiteResult =
  | ({ ok: true } & UsoIA)
  | ({ ok: false; error: string } & UsoIA);

function mesAtual(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function proximoReset(): string {
  const d = new Date();
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  return `01/${String(next.getUTCMonth() + 1).padStart(2, "0")}/${next.getUTCFullYear()}`;
}

/**
 * Verifica o limite mensal e, se ok, incrementa o contador.
 * Deve ser chamada ANTES de invocar a IA.
 * Se retornar { ok: false }, NÃO chame a IA.
 */
export async function verificarEIncrementarUsoIA(
  profId: string
): Promise<VerificarLimiteResult> {
  const mes = mesAtual();

  const { data, error: fetchErr } = await supabaseAdmin
    .from("professor_uso_ia")
    .select("geracoes_usadas, mes_referencia")
    .eq("professor_id", profId)
    .maybeSingle();

  if (fetchErr) {
    return {
      ok: false,
      error: "Erro ao verificar limite de IA.",
      geracoes_usadas: 0,
      limite: LIMITE_MENSAL_IA,
    };
  }

  const mesChanged = !data || data.mes_referencia !== mes;
  const usadas = mesChanged ? 0 : (data.geracoes_usadas as number);

  if (usadas >= LIMITE_MENSAL_IA) {
    return {
      ok: false,
      error: `Limite de ${LIMITE_MENSAL_IA} gerações de IA atingido este mês. Renova em ${proximoReset()}.`,
      geracoes_usadas: usadas,
      limite: LIMITE_MENSAL_IA,
    };
  }

  const { error: upsertErr } = await supabaseAdmin
    .from("professor_uso_ia")
    .upsert(
      { professor_id: profId, geracoes_usadas: usadas + 1, mes_referencia: mes },
      { onConflict: "professor_id" }
    );

  if (upsertErr) {
    return {
      ok: false,
      error: "Erro ao registrar uso de IA.",
      geracoes_usadas: usadas,
      limite: LIMITE_MENSAL_IA,
    };
  }

  return { ok: true, geracoes_usadas: usadas + 1, limite: LIMITE_MENSAL_IA };
}

/**
 * Apenas leitura do contador atual — sem incrementar.
 * Para exibir o badge na UI antes de qualquer geração.
 */
export async function consultarUsoIA(profId: string): Promise<UsoIA> {
  const { data } = await supabaseAdmin
    .from("professor_uso_ia")
    .select("geracoes_usadas, mes_referencia")
    .eq("professor_id", profId)
    .maybeSingle();

  const mes = mesAtual();
  const usadas =
    !data || data.mes_referencia !== mes ? 0 : (data.geracoes_usadas as number);

  return { geracoes_usadas: usadas, limite: LIMITE_MENSAL_IA };
}
