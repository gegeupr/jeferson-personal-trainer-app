"use server";

import { supabaseAdmin } from "@/utils/supabaseAdmin";
import Anthropic from "@anthropic-ai/sdk";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConfigTreino = {
  dias_por_semana: number;
  foco_muscular: string;
  duracao_minutos: number;
  nivel: "iniciante" | "intermediario" | "avancado";
  equipamentos: string;
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

export type TreinoGerado = {
  nome: string;
  descricao: string;
  duracao_minutos: number;
  nivel: string;
  exercicios: ExercicioGerado[];
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
                `{"fonte":"catalogo","id":"${e.id}","nome":"${e.nome}","grupo":"${e.grupo_muscular ?? ""}","equip":"${e.equipamento ?? ""}","nivel":"${e.nivel ?? ""}"}`
            )
            .join("\n")
        : "Catálogo vazio.";

    // 3. Montar o prompt
    const promptTexto = `Você é um personal trainer experiente em prescrição de treinos. Com base nos dados abaixo, monte um treino personalizado usando APENAS os exercícios fornecidos nas listas.

=== DADOS DO ALUNO ===
Nome: ${aluno?.nome_completo ?? "Aluno"}
${anamneseTexto}

=== HISTÓRICO DE TREINOS (últimos concluídos) ===
${historicoTexto}

=== CONFIGURAÇÕES SOLICITADAS ===
Dias por semana: ${config.dias_por_semana}
Foco muscular: ${config.foco_muscular}
Duração: ${config.duracao_minutos} minutos
Nível: ${config.nivel}
Equipamentos disponíveis: ${config.equipamentos || "Academia completa"}

=== BIBLIOTECA DO PROFESSOR (prefira estes) ===
${bibTexto}

=== CATÁLOGO GLOBAL (use como complemento) ===
${catTexto}

=== REGRAS ===
1. Use APENAS exercícios das listas acima, com o "id" e "fonte" exatos.
2. Prefira a biblioteca do professor. Complemente com o catálogo se necessário.
3. Respeite TODAS as lesões, cirurgias e restrições mencionadas.
4. Adapte séries/repetições ao nível informado.
5. Retorne APENAS JSON puro, sem markdown, sem texto extra, sem \`\`\`.

=== FORMATO DE RETORNO ===
{"nome":"...","descricao":"...","duracao_minutos":${config.duracao_minutos},"nivel":"${config.nivel}","exercicios":[{"fonte":"biblioteca","exercicio_id":"uuid","nome":"Nome","series":3,"repeticoes":"8-12","descanso_segundos":60,"observacao":"dica opcional"}]}`;

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
          text: `A seguir estão ${fotasValidas.length} foto(s) de progresso do aluno (mais recentes primeiro). Use apenas para avaliar composição corporal e postura visível.`,
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
      max_tokens: 4096,
      system:
        "Você é um personal trainer especializado em prescrição de treinos. Responda SEMPRE com JSON puro e válido, sem texto adicional, sem markdown, sem explicações. Apenas o objeto JSON.",
      messages: [{ role: "user", content }],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";

    // 6. Parse JSON — extrai o objeto JSON por contagem de chaves
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

    // 7. Validar IDs — remover exercícios inventados
    const bibIds = new Set(biblioteca.map((e) => e.id));
    const catIds = new Set(catalogo.map((e) => e.id));
    treino.exercicios = treino.exercicios.filter((ex) => {
      if (ex.fonte === "biblioteca") return bibIds.has(ex.exercicio_id);
      if (ex.fonte === "catalogo") return catIds.has(ex.exercicio_id);
      return false;
    });

    if (treino.exercicios.length === 0) {
      return {
        ok: false,
        error:
          "A IA não retornou exercícios válidos da biblioteca/catálogo. Tente novamente ou ajuste as configurações.",
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
    // 1. Criar treino
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

    // 2. Criar rotina
    const { data: rotinaRow, error: rotinaErr } = await supabaseAdmin
      .from("rotinas_diarias")
      .insert({
        plano_id: treinoRow.id,
        nome: treino.nome,
        descricao: treino.descricao,
        aluno_id: alunoId,
      })
      .select("id")
      .single();

    if (rotinaErr || !rotinaRow) throw rotinaErr ?? new Error("Erro ao criar rotina.");

    // 3. Criar exercícios da rotina
    const rows = treino.exercicios.map((ex, i) => ({
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

    return { ok: true, treinoId: treinoRow.id };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Erro ao salvar treino." };
  }
}
