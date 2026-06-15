"use server";

import { supabaseAdmin } from "@/utils/supabaseAdmin";
import Anthropic from "@anthropic-ai/sdk";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConfigTreino = {
  dias_por_semana: number;
  tipo_divisao: string;
  duracao_minutos: number;
  nivel: "iniciante" | "intermediario" | "avancado";
  equipamentos: string;
  observacoes?: string;
};

export type ExercicioGerado = {
  fonte: "biblioteca" | "catalogo";
  exercicio_id: string;
  nome: string;
  series: number;
  repeticoes: string;
  descanso_segundos: number;
  observacao?: string;
};

export type RotinaGerada = {
  nome: string;
  foco: string;
  exercicios: ExercicioGerado[];
};

export type TreinoGerado = {
  nome: string;
  descricao: string;
  duracao_minutos: number;
  nivel: string;
  divisao: string;
  rotinas: RotinaGerada[];
};

export type GerarTreinoResult =
  | { ok: true; treino: TreinoGerado }
  | { ok: false; error: string };

export type SalvarTreinoResult =
  | { ok: true; treinoId: string }
  | { ok: false; error: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extrairJSON(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") depth--;
    if (depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

async function urlParaBase64(
  url: string
): Promise<{ data: string; mimeType: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const data = Buffer.from(buffer).toString("base64");
    const mimeType = res.headers.get("content-type") || "image/jpeg";
    return { data, mimeType };
  } catch {
    return null;
  }
}

function normalizeImageMime(
  mime: string
): "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  if (mime.includes("png")) return "image/png";
  if (mime.includes("gif")) return "image/gif";
  if (mime.includes("webp")) return "image/webp";
  return "image/jpeg";
}

// ─── Guia de periodização por dias + tipo ────────────────────────────────────

function buildGuiaDivisao(dias: number, tipo: string): string {
  const ia = tipo === "IA decide o melhor split";
  const fullBody = tipo.toLowerCase().includes("full body");
  const supInf = tipo.toLowerCase().includes("superior") || tipo.toLowerCase().includes("inferior");
  const ppl = tipo.toLowerCase().includes("push") || tipo.toLowerCase().includes("pull") || tipo.toLowerCase().includes("legs");
  const abcd = tipo.toLowerCase().includes("a/b/c/d");

  if (fullBody) {
    if (dias <= 3) {
      return `Divisão Full Body — ${dias} dias:
- Treino A: Full Body — ênfase Peito, Costas (compostos: supino, puxada, remada, desenvolvimento)
- Treino B: Full Body — ênfase Pernas, Glúteos (compostos: agachamento, leg press, afundo, stiff)
${dias === 3 ? "- Treino C: Full Body — ênfase Core, Ombros e acessórios (elevações, rotadores, abdominais)" : ""}
Cada dia usa exercícios DIFERENTES — não repita os mesmos exercícios entre os dias.`;
    }
    if (dias === 4) {
      return `Para Full Body 4x/semana, adote Divisão Superior/Inferior:
- Treino A: Superior (Peito e Ombros — push)
- Treino B: Inferior (Pernas anteriores: quadríceps, panturrilha)
- Treino C: Superior (Costas e Bíceps — pull)
- Treino D: Inferior (Pernas posteriores: isquiotibiais, glúteos)`;
    }
    return `Para Full Body ${dias}x/semana com aluno avançado, adote Divisão Push/Pull/Legs:
- Treino A (Push): Peito, Ombros, Tríceps — supino, desenvolvimento, elevações, tríceps
- Treino B (Pull): Costas, Bíceps — puxada, remada, rosca, face pull
- Treino C (Legs): Pernas completas — agachamento, leg press, stiff, afundo, panturrilha
${dias >= 4 ? "- Treino D (Push complementar): Peito inclinado, Ombros lateral, Tríceps close grip" : ""}
${dias >= 5 ? "- Treino E (Pull complementar + Glúteos): Remada, puxador, rosca concentrada, hip thrust" : ""}
${dias >= 6 ? "- Treino F (Legs complementar): Extensora, flexora, agachamento búlgaro, abdutora, panturrilha" : ""}`;
  }

  if (supInf) {
    return `Divisão Superior/Inferior — ${dias} dias:
- Treino A: Superior Push (Peito, Ombros, Tríceps)
- Treino B: Inferior Quad-dominant (Quadríceps, Panturrilha)
- Treino C: Superior Pull (Costas, Bíceps, Trapézio)
- Treino D: Inferior Hip-dominant (Glúteos, Isquiotibiais, Panturrilha)
${dias === 5 ? "- Treino E: Superior completo ou Core/Cardio" : ""}`;
  }

  if (ppl) {
    return `Divisão Push/Pull/Legs — ${dias} dias:
- Treino A (Push): Peito, Ombros anteriores/médios, Tríceps
- Treino B (Pull): Costas, Bíceps, Ombros posteriores, Trapézio
- Treino C (Legs): Quadríceps, Isquiotibiais, Glúteos, Panturrilha
${dias >= 4 ? "- Treino D (Push 2): Peito inclinado, Ombros lateral, Tríceps acessórios" : ""}
${dias >= 5 ? "- Treino E (Pull 2): Puxador, Remada, Rosca concentrada, Posterior de ombro" : ""}
${dias >= 6 ? "- Treino F (Legs 2): Glúteo e isquio focado — hip thrust, stiff, afundo, panturrilha" : ""}`;
  }

  if (abcd || dias >= 4) {
    if (dias === 4) {
      return `Divisão A/B/C/D — 4 dias:
- Treino A: Peito e Tríceps
- Treino B: Costas e Bíceps
- Treino C: Pernas (Quadríceps, Panturrilha)
- Treino D: Ombros, Glúteos e Isquiotibiais`;
    }
    if (dias === 5) {
      return `Divisão A/B/C/D/E — 5 dias (split bodybuilder):
- Treino A: Peito (compostos + isoladores)
- Treino B: Costas (largura + espessura)
- Treino C: Pernas Posteriores — Glúteos e Isquiotibiais (stiff, cadeira, hip thrust)
- Treino D: Pernas Anteriores — Quadríceps e Panturrilha (agachamento, leg press, extensora)
- Treino E: Ombros e Braços (desenvolvimento, elevações, rosca, tríceps)`;
    }
    return `Divisão em ${dias} grupos musculares:
Distribua: Peito / Costas / Pernas (Quad) / Pernas (Post+Glúteo) / Ombros / Braços
Cada treino foca em 1-2 grupos musculares com alto volume.`;
  }

  if (ia) {
    return `A IA deve escolher a MELHOR divisão para o perfil do aluno:
- Iniciante 2-3x/semana: Full Body
- Intermediário 3-4x/semana: Superior/Inferior ou Push/Pull/Legs
- Avançado 4-6x/semana: Push/Pull/Legs ou Split por grupo muscular (A/B/C/D/E)
Com ${dias} dias e nível avançado/bodybuilder: use Split por grupo muscular.`;
  }

  return `Divisão solicitada: ${tipo} — ${dias} dias de treino.
Distribua os grupos musculares de forma inteligente entre os ${dias} dias, garantindo recuperação adequada.`;
}

// ─── Action: gerar treino ─────────────────────────────────────────────────────

export async function gerarTreinoComIA(
  alunoId: string,
  profId: string,
  config: ConfigTreino
): Promise<GerarTreinoResult> {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { ok: false, error: "ANTHROPIC_API_KEY não configurado." };

    // 1. Buscar todos os dados em paralelo
    const [
      profileResult,
      anamneseResult,
      fotosResult,
      arquivosResult,
      historicoResult,
      bibResult,
      catResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("nome_completo")
        .eq("id", alunoId)
        .single(),

      supabaseAdmin
        .from("anamneses")
        .select(
          "objetivos_principais, nivel_atividade_fisica_atual, disponibilidade_treino, historico_saude_doencas, historico_lesoes_cirurgias, medicamentos_suplementos, restricoes_alimentares, alergias, observacoes_gerais"
        )
        .eq("aluno_id", alunoId)
        .maybeSingle(),

      supabaseAdmin
        .from("progresso_fotos")
        .select("url, data_foto, descricao")
        .eq("aluno_id", alunoId)
        .order("data_foto", { ascending: false })
        .limit(4),

      supabaseAdmin
        .from("arquivos")
        .select("url, nome_arquivo, tipo")
        .eq("aluno_id", alunoId)
        .ilike("tipo", "%pdf%")
        .limit(2),

      supabaseAdmin
        .from("aluno_rotina_conclusoes")
        .select(
          "concluido_em, feedback_nota, feedback_texto, treino:treinos(nome), rotina:rotinas_diarias(nome)"
        )
        .eq("aluno_id", alunoId)
        .order("concluido_em", { ascending: false })
        .limit(10),

      supabaseAdmin
        .from("exercicios")
        .select("id, nome, descricao")
        .eq("professor_id", profId)
        .order("nome"),

      supabaseAdmin
        .from("exercicios_catalogo")
        .select("id, nome, grupo_muscular, equipamento, nivel, categoria")
        .order("nome")
        .limit(300),
    ]);

    const aluno = profileResult.data;
    const anamnese = anamneseResult.data;
    const fotos = fotosResult.data || [];
    const arquivos = arquivosResult.data || [];
    const historico = (historicoResult.data || []) as any[];
    const biblioteca = bibResult.data || [];
    const catalogo = catResult.data || [];

    // 2. Montar textos para o prompt
    const anamneseTexto = anamnese
      ? [
          `Objetivos: ${anamnese.objetivos_principais || "Não informado"}`,
          `Nível atual: ${anamnese.nivel_atividade_fisica_atual || "Não informado"}`,
          `Disponibilidade: ${anamnese.disponibilidade_treino || "Não informado"}`,
          `Histórico de saúde: ${anamnese.historico_saude_doencas || "Nenhum"}`,
          `Lesões/cirurgias: ${anamnese.historico_lesoes_cirurgias || "Nenhuma"}`,
          `Medicamentos: ${anamnese.medicamentos_suplementos || "Nenhum"}`,
          `Alergias: ${anamnese.alergias || "Nenhuma"}`,
          `Restrições: ${anamnese.restricoes_alimentares || "Nenhuma"}`,
          `Obs. gerais: ${anamnese.observacoes_gerais || "Nenhuma"}`,
        ].join("\n")
      : "Anamnese não preenchida.";

    const historicoTexto =
      historico.length > 0
        ? historico
            .map(
              (h) =>
                `${String(h.concluido_em).slice(0, 10)}: ${h.treino?.nome ?? "Treino"} › ${h.rotina?.nome ?? "Rotina"} (nota: ${h.feedback_nota ?? "?"}/5${h.feedback_texto ? ` — "${h.feedback_texto}"` : ""})`
            )
            .join("\n")
        : "Nenhum treino concluído registrado.";

    const bibTexto =
      biblioteca.length > 0
        ? biblioteca
            .map(
              (e) =>
                `{"fonte":"biblioteca","id":"${e.id}","nome":"${e.nome}"${e.descricao ? `,"desc":"${e.descricao.slice(0, 80)}"` : ""}}`
            )
            .join("\n")
        : "Biblioteca vazia.";

    const catTexto =
      catalogo.length > 0
        ? catalogo
            .map(
              (e) =>
                `{"fonte":"catalogo","id":"${e.id}","nome":"${e.nome}","grupo":"${e.grupo_muscular ?? ""}","equip":"${e.equipamento ?? ""}","nivel":"${e.nivel ?? ""}","cat":"${e.categoria ?? ""}"}`
            )
            .join("\n")
        : "Catálogo vazio.";

    // 3. Montar o prompt
    const guiaDivisao = buildGuiaDivisao(config.dias_por_semana, config.tipo_divisao);

    const promptTexto = `Você é um personal trainer especializado em periodização. Sua tarefa é criar um PLANO DE TREINO PERIODIZADO com MÚLTIPLAS ROTINAS DIÁRIAS.

=== DADOS DO ALUNO ===
Nome: ${aluno?.nome_completo ?? "Aluno"}
${anamneseTexto}

=== HISTÓRICO DE TREINOS ===
${historicoTexto}

=== SOLICITAÇÃO DO PROFESSOR ===
Dias de treino por semana: ${config.dias_por_semana}
Tipo de periodização/divisão: ${config.tipo_divisao}
Duração de cada sessão: ${config.duracao_minutos} minutos
Nível do aluno: ${config.nivel}
Equipamentos: ${config.equipamentos || "Academia completa"}
${config.observacoes ? `Observações: ${config.observacoes}` : ""}

=== GUIA DE PERIODIZAÇÃO ===
${guiaDivisao}

=== EXERCÍCIOS — BIBLIOTECA DO PROFESSOR (USE PRIMEIRO) ===
${bibTexto}

=== EXERCÍCIOS — CATÁLOGO GLOBAL (complemente se necessário) ===
${catTexto}

=== REGRAS ABSOLUTAS ===
1. O JSON deve ter o campo "rotinas" com um ARRAY de EXATAMENTE ${config.dias_por_semana} objetos.
2. Cada objeto no array "rotinas" é uma SESSÃO DE TREINO DIFERENTE (dia A, dia B, dia C...).
3. NUNCA coloque todos os exercícios em uma única rotina — distribua entre as ${config.dias_por_semana} rotinas.
4. Cada rotina deve ter entre 6 e 12 exercícios, todos com foco muscular ESPECÍFICO daquele dia.
5. Use APENAS IDs dos exercícios listados acima — nunca invente IDs.
6. Prefira biblioteca do professor. Use catálogo para complementar.
7. Respeite TODAS as restrições, lesões e limitações do aluno.
8. Retorne SOMENTE JSON puro — sem markdown, sem texto, sem \`\`\`.

=== FORMATO EXATO DO JSON (obrigatório) ===
{
  "nome": "Plano [Tipo de Divisão] — [Nome do Aluno]",
  "descricao": "Descrição do plano e objetivos",
  "duracao_minutos": ${config.duracao_minutos},
  "nivel": "${config.nivel}",
  "divisao": "Nome da divisão adotada",
  "rotinas": [
    {
      "nome": "Treino A — [Grupos Musculares do Dia 1]",
      "foco": "[Grupos musculares principais do dia 1]",
      "exercicios": [
        {"fonte": "catalogo", "exercicio_id": "uuid-real-da-lista", "nome": "Nome do Exercício", "series": 4, "repeticoes": "8-12", "descanso_segundos": 90, "observacao": "dica"},
        {"fonte": "biblioteca", "exercicio_id": "uuid-real-da-lista", "nome": "Nome do Exercício", "series": 3, "repeticoes": "10", "descanso_segundos": 60, "observacao": ""}
      ]
    },
    {
      "nome": "Treino B — [Grupos Musculares do Dia 2]",
      "foco": "[Grupos musculares principais do dia 2]",
      "exercicios": [
        {"fonte": "catalogo", "exercicio_id": "uuid-real-da-lista", "nome": "Outro Exercício", "series": 4, "repeticoes": "6-10", "descanso_segundos": 120, "observacao": ""}
      ]
    }
  ]
}

ATENÇÃO: O exemplo acima mostra 2 rotinas, mas você DEVE criar EXATAMENTE ${config.dias_por_semana} rotinas (uma por dia de treino). Cada rotina é independente e tem exercícios próprios.`;

    // 4. Montar content blocks para o Claude
    const content: Anthropic.MessageParam["content"] = [
      { type: "text", text: promptTexto },
    ];

    // Adicionar fotos de progresso (máx 4)
    if (fotos.length > 0) {
      const fotosConvertidas = await Promise.all(
        fotos.slice(0, 4).map((f) => urlParaBase64(f.url))
      );
      const fotasValidas = fotosConvertidas.filter(Boolean);
      if (fotasValidas.length > 0) {
        content.push({
          type: "text",
          text: `Fotos de progresso do aluno (${fotasValidas.length} mais recentes). Use para avaliar composição corporal e postura:`,
        });
        for (const f of fotasValidas) {
          content.push({
            type: "image",
            source: {
              type: "base64",
              media_type: normalizeImageMime(f!.mimeType),
              data: f!.data,
            },
          });
        }
      }
    }

    // Adicionar PDFs de exames (máx 2)
    if (arquivos.length > 0) {
      const pdfsConvertidos = await Promise.all(
        arquivos.slice(0, 2).map((a) => urlParaBase64(a.url))
      );
      const pdfsValidos = pdfsConvertidos.filter(Boolean);
      if (pdfsValidos.length > 0) {
        content.push({ type: "text", text: "Exames/documentos do aluno:" });
        for (const p of pdfsValidos) {
          content.push({
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: p!.data,
            },
          } as any);
        }
      }
    }

    // 5. Chamar Claude
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system:
        "Você é um personal trainer especializado em periodização. Responda SEMPRE com JSON puro e válido, sem texto adicional, sem markdown, sem explicações. Apenas o objeto JSON conforme solicitado.",
      messages: [{ role: "user", content }],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";

    // 6. Parse JSON
    const jsonStr = extrairJSON(rawText);
    if (!jsonStr) {
      console.error("[gerarTreino] resposta sem JSON:", rawText.slice(0, 300));
      return { ok: false, error: "A IA não retornou um JSON válido. Tente novamente." };
    }

    let treino: TreinoGerado;
    try {
      treino = JSON.parse(jsonStr) as TreinoGerado;
    } catch (parseErr: any) {
      console.error("[gerarTreino] JSON inválido:", jsonStr.slice(0, 300), parseErr?.message);
      return { ok: false, error: "A IA retornou um JSON malformado. Tente novamente." };
    }

    // 7. Normalizar: suporte a formato legado (exercicios no topo) e novo (rotinas[])
    if (!treino.rotinas && (treino as any).exercicios) {
      treino.rotinas = [{
        nome: treino.nome,
        foco: "Geral",
        exercicios: (treino as any).exercicios,
      }];
    }

    if (!Array.isArray(treino.rotinas) || treino.rotinas.length === 0) {
      return { ok: false, error: "A IA não gerou rotinas de treino. Tente novamente." };
    }

    // 8. Validar IDs — remover exercícios inventados em todas as rotinas
    const bibIds = new Set(biblioteca.map((e) => e.id));
    const catIds = new Set(catalogo.map((e) => e.id));

    treino.rotinas = treino.rotinas.map((rotina) => ({
      ...rotina,
      exercicios: (rotina.exercicios || []).filter((ex) => {
        if (ex.fonte === "biblioteca") return bibIds.has(ex.exercicio_id);
        if (ex.fonte === "catalogo") return catIds.has(ex.exercicio_id);
        return false;
      }),
    }));

    const totalExercicios = treino.rotinas.reduce(
      (sum, r) => sum + r.exercicios.length,
      0
    );

    if (totalExercicios === 0) {
      return {
        ok: false,
        error: "A IA não retornou exercícios válidos da biblioteca/catálogo. Tente novamente.",
      };
    }

    return { ok: true, treino };
  } catch (e: any) {
    const msg: string = e?.message ?? "Erro desconhecido.";
    console.error("[gerarTreino] erro geral:", msg);
    return { ok: false, error: msg };
  }
}

// ─── Action: salvar treino gerado ─────────────────────────────────────────────

export async function salvarTreinoGerado(
  alunoId: string,
  profId: string,
  treino: TreinoGerado
): Promise<SalvarTreinoResult> {
  try {
    // 1. Criar treino (plano geral)
    const { data: treinoRow, error: treinoErr } = await supabaseAdmin
      .from("treinos")
      .insert({
        nome: treino.nome,
        descricao: treino.descricao,
        aluno_id: alunoId,
        professor_id: profId,
        dificuldade: treino.nivel,
        objetivo: treino.descricao,
        gerado_por_ia: true,
      })
      .select("id")
      .single();

    if (treinoErr || !treinoRow) throw treinoErr ?? new Error("Erro ao criar treino.");

    // 2. Criar uma rotina_diaria por rotina gerada
    for (const rotina of treino.rotinas) {
      const { data: rotinaRow, error: rotinaErr } = await supabaseAdmin
        .from("rotinas_diarias")
        .insert({
          plano_id: treinoRow.id,
          nome: rotina.nome,
          descricao: rotina.foco || null,
          aluno_id: alunoId,
        })
        .select("id")
        .single();

      if (rotinaErr || !rotinaRow) throw rotinaErr ?? new Error(`Erro ao criar rotina "${rotina.nome}".`);

      // 3. Criar exercícios desta rotina
      if (rotina.exercicios.length === 0) continue;

      const rows = rotina.exercicios.map((ex, i) => ({
        rotina_id: rotinaRow.id,
        exercicio_id: ex.fonte === "biblioteca" ? ex.exercicio_id : null,
        catalogo_id: ex.fonte === "catalogo" ? ex.exercicio_id : null,
        ordem: i + 1,
        series: ex.series,
        repeticoes: ex.repeticoes,
        intervalo: ex.descanso_segundos ? `${ex.descanso_segundos}s` : null,
        observacoes: ex.observacao ?? null,
      }));

      const { error: exErr } = await supabaseAdmin
        .from("treino_exercicios")
        .insert(rows);

      if (exErr) throw exErr;
    }

    return { ok: true, treinoId: treinoRow.id };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Erro ao salvar treino." };
  }
}
