"use server";

import { supabaseAdmin } from "@/utils/supabaseAdmin";

const LIMITE_MENSAL_GERACOES = 30;
const LIMITE_MENSAL_REVISOES = 60;

// ── Tipos ──────────────────────────────────────────────────────────────────────

export type TipoOperacaoIA = "geracao" | "revisao";

export type UsoIA = {
  geracoes_usadas:  number;
  revisoes_usadas:  number;
  limite_geracoes:  number;
  limite_revisoes:  number;
};

export type VerificarLimiteResult =
  | ({ ok: true } & UsoIA)
  | ({ ok: false; error: string } & UsoIA);

// ── Helpers ────────────────────────────────────────────────────────────────────

function mesAtual(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function proximoReset(): string {
  const d = new Date();
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  return `01/${String(next.getUTCMonth() + 1).padStart(2, "0")}/${next.getUTCFullYear()}`;
}

// ── Principal ──────────────────────────────────────────────────────────────────

/**
 * Verifica o limite mensal do tipo solicitado e, se ok, incrementa o contador.
 * Deve ser chamada ANTES de invocar a IA.
 * Se retornar { ok: false }, NÃO chame a IA.
 */
export async function verificarEIncrementarUsoIA(
  profId: string,
  tipo: TipoOperacaoIA = "geracao"
): Promise<VerificarLimiteResult> {
  const mes = mesAtual();

  const { data, error: fetchErr } = await supabaseAdmin
    .from("professor_uso_ia")
    .select("geracoes_usadas, revisoes_usadas_mes, mes_referencia")
    .eq("professor_id", profId)
    .maybeSingle();

  const vazio: UsoIA = {
    geracoes_usadas: 0,
    revisoes_usadas: 0,
    limite_geracoes: LIMITE_MENSAL_GERACOES,
    limite_revisoes: LIMITE_MENSAL_REVISOES,
  };

  if (fetchErr) {
    return { ok: false, error: "Erro ao verificar limite de IA.", ...vazio };
  }

  const mesChanged = !data || data.mes_referencia !== mes;

  // Se o mês virou, ambos os contadores resetam
  const geracoes = mesChanged ? 0 : ((data.geracoes_usadas    as number) ?? 0);
  const revisoes = mesChanged ? 0 : ((data.revisoes_usadas_mes as number) ?? 0);

  const uso: UsoIA = {
    geracoes_usadas: geracoes,
    revisoes_usadas: revisoes,
    limite_geracoes: LIMITE_MENSAL_GERACOES,
    limite_revisoes: LIMITE_MENSAL_REVISOES,
  };

  if (tipo === "geracao" && geracoes >= LIMITE_MENSAL_GERACOES) {
    return {
      ok: false,
      error: `Limite de ${LIMITE_MENSAL_GERACOES} gerações atingido este mês. Renova em ${proximoReset()}.`,
      ...uso,
    };
  }

  if (tipo === "revisao" && revisoes >= LIMITE_MENSAL_REVISOES) {
    return {
      ok: false,
      error: `Limite de ${LIMITE_MENSAL_REVISOES} revisões atingido este mês. Renova em ${proximoReset()}.`,
      ...uso,
    };
  }

  const novoGeracoes = tipo === "geracao" ? geracoes + 1 : geracoes;
  const novoRevisoes = tipo === "revisao" ? revisoes + 1 : revisoes;

  const { error: upsertErr } = await supabaseAdmin
    .from("professor_uso_ia")
    .upsert(
      {
        professor_id:       profId,
        geracoes_usadas:    novoGeracoes,
        revisoes_usadas_mes: novoRevisoes,
        mes_referencia:     mes,
      },
      { onConflict: "professor_id" }
    );

  if (upsertErr) {
    return { ok: false, error: "Erro ao registrar uso de IA.", ...uso };
  }

  return {
    ok: true,
    geracoes_usadas: novoGeracoes,
    revisoes_usadas: novoRevisoes,
    limite_geracoes: LIMITE_MENSAL_GERACOES,
    limite_revisoes: LIMITE_MENSAL_REVISOES,
  };
}

// ── Leitura sem incrementar ────────────────────────────────────────────────────

/**
 * Apenas leitura do contador atual — sem incrementar.
 * Para exibir o badge na UI antes de qualquer operação.
 */
export async function consultarUsoIA(profId: string): Promise<UsoIA> {
  const { data } = await supabaseAdmin
    .from("professor_uso_ia")
    .select("geracoes_usadas, revisoes_usadas_mes, mes_referencia")
    .eq("professor_id", profId)
    .maybeSingle();

  const mes = mesAtual();
  const mesChanged = !data || data.mes_referencia !== mes;

  return {
    geracoes_usadas: mesChanged ? 0 : ((data.geracoes_usadas    as number) ?? 0),
    revisoes_usadas: mesChanged ? 0 : ((data.revisoes_usadas_mes as number) ?? 0),
    limite_geracoes: LIMITE_MENSAL_GERACOES,
    limite_revisoes: LIMITE_MENSAL_REVISOES,
  };
}
