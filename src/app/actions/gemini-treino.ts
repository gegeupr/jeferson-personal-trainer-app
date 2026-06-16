"use server";
// v2 — prompt com guias de grupos musculares e regras entre dias
import { supabaseAdmin } from "@/utils/supabaseAdmin";
import Anthropic from "@anthropic-ai/sdk";
import { verificarEIncrementarUsoIA } from "@/lib/verificarLimiteIA";
import { criarNotificacao } from "@/lib/criarNotificacao";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConfigTreino = {
  dias_por_semana: number;
  tipo_divisao: string;
  duracao_minutos: number;
  nivel: "iniciante" | "intermediario" | "avancado";
  equipamentos: string;
  observacoes?: string;
  perfil_modelo?: string;
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

// Extrai keywords de contraindicação a partir do texto livre da anamnese
function extrairContraindicacoesAnamnese(anamnese: Record<string, unknown> | null | undefined): string[] {
  if (!anamnese) return [];
  const texto = [
    anamnese.historico_lesoes_cirurgias,
    anamnese.historico_saude_doencas,
    anamnese.observacoes_gerais,
  ].filter(Boolean).join(" ").toLowerCase();

  const map: Array<[RegExp, string]> = [
    [/joelho/,                              "lesao_joelho"],
    [/ombro/,                               "lesao_ombro"],
    [/lombar|coluna|hérnia discal|hérnia de disco|hernia/i, "lesao_lombar"],
    [/cotovelo|epicondil/,                  "lesao_cotovelo"],
    [/hérnia|hernia/,                       "hernia_discal"],
    [/tornozelo/,                           "lesao_tornozelo"],
  ];

  const resultado: string[] = [];
  for (const [re, tag] of map) {
    if (re.test(texto) && !resultado.includes(tag)) resultado.push(tag);
  }
  return resultado;
}

// ─── Catálogo filtrado e deduplicado por rotina ──────────────────────────────

const TECNICAS_ESPECIAIS = [
  'Drop-Set', 'Rest-Pause', 'Isometria', 'Tempo',
  'Amplitude Parcial', 'Pausas', '1 e 1/2', 'Unilateral',
];

const EQUIP_SUFFIX = /\s+(?:com|no|na)\s+(?:Barra(?:\s+W)?|Halteres?|Halter|Máquina|Smith|Polia|Banco Romano|Kettlebell)\s*$/i;

function extrairBase(nome: string): string {
  return nome
    .replace(/\s*\(.*$/, '')
    .replace(/\s+\d+[°º]$/, '')
    .replace(EQUIP_SUFFIX, '')
    .trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dedupPorBase(exercicios: any[]): any[] {
  const grupos = new Map<string, any[]>();
  for (const ex of exercicios) {
    const base = extrairBase(ex.nome as string);
    if (!grupos.has(base)) grupos.set(base, []);
    grupos.get(base)!.push(ex);
  }
  const result: any[] = [];
  for (const grupo of grupos.values()) {
    const limpos = grupo.filter((ex) => !TECNICAS_ESPECIAIS.some((t) => (ex.nome as string).includes(t)));
    const candidatos = limpos.length > 0 ? limpos : grupo;
    result.push(candidatos.reduce((a: any, b: any) => (a.nome as string).length <= (b.nome as string).length ? a : b));
  }
  return result;
}

type DiaFiltro = { label: string; patterns: string[]; outro_kws: string[] };

const CORE_PATTERNS = new Set(['core_anti_extensao', 'core_rotacao']);

const SPLIT_MAP: Record<string, DiaFiltro[]> = {
  abcde: [
    { label: 'Peito e Tríceps',                              patterns: ['empurrar_horizontal', 'extensao_cotovelo'],                       outro_kws: ['peitoral', 'tríceps'] },
    { label: 'Costas e Bíceps',                              patterns: ['puxada_vertical', 'puxada_horizontal', 'flexao_cotovelo'],         outro_kws: ['costas', 'latíssimo', 'romboide', 'trapézio', 'bíceps'] },
    { label: 'Bumbum e Posterior',                            patterns: ['dominante_quadril'],                                              outro_kws: ['glúteo médio', 'adutor'] },
    { label: 'Coxa e Panturrilha',                           patterns: ['dominante_joelho'],                                               outro_kws: ['gastrocnêmio', 'sóleo', 'panturrilha'] },
    { label: 'Ombros e Braços',                              patterns: ['empurrar_vertical', 'flexao_cotovelo', 'extensao_cotovelo'],       outro_kws: ['ombro', 'deltoid', 'trapézio', 'bíceps', 'tríceps'] },
  ],
  abcd: [
    { label: 'Peito e Tríceps',                              patterns: ['empurrar_horizontal', 'extensao_cotovelo'],                       outro_kws: ['peitoral', 'tríceps'] },
    { label: 'Costas e Bíceps',                              patterns: ['puxada_vertical', 'puxada_horizontal', 'flexao_cotovelo'],         outro_kws: ['costas', 'latíssimo', 'romboide', 'trapézio', 'bíceps'] },
    { label: 'Coxa e Panturrilha',                            patterns: ['dominante_joelho'],                                               outro_kws: ['gastrocnêmio', 'sóleo', 'panturrilha'] },
    { label: 'Ombros, Bumbum e Posterior',                   patterns: ['empurrar_vertical', 'dominante_quadril'],                         outro_kws: ['ombro', 'deltoid', 'trapézio', 'glúteo médio', 'adutor'] },
  ],
  ppl: [
    { label: 'Push — Peito, Ombros e Tríceps',               patterns: ['empurrar_horizontal', 'empurrar_vertical', 'extensao_cotovelo'],  outro_kws: ['peitoral', 'ombro', 'deltoid', 'tríceps'] },
    { label: 'Pull — Costas e Bíceps',                       patterns: ['puxada_vertical', 'puxada_horizontal', 'flexao_cotovelo'],         outro_kws: ['costas', 'latíssimo', 'romboide', 'trapézio', 'bíceps'] },
    { label: 'Legs — Pernas completas',                      patterns: ['dominante_quadril', 'dominante_joelho'],                          outro_kws: ['gastrocnêmio', 'sóleo', 'panturrilha', 'glúteo médio', 'adutor'] },
  ],
  supinf: [
    { label: 'Superior Push — Peito, Ombros e Tríceps',      patterns: ['empurrar_horizontal', 'empurrar_vertical', 'extensao_cotovelo'],  outro_kws: ['peitoral', 'ombro', 'deltoid', 'tríceps'] },
    { label: 'Inferior — Coxa e Panturrilha',                 patterns: ['dominante_joelho'],                                               outro_kws: ['gastrocnêmio', 'sóleo', 'panturrilha'] },
    { label: 'Superior Pull — Costas e Bíceps',              patterns: ['puxada_vertical', 'puxada_horizontal', 'flexao_cotovelo'],         outro_kws: ['costas', 'latíssimo', 'romboide', 'trapézio', 'bíceps'] },
    { label: 'Inferior — Bumbum e Posterior',                 patterns: ['dominante_quadril'],                                              outro_kws: ['glúteo médio', 'adutor'] },
  ],
};

function getSplitKey(dias: number, tipo: string): string | null {
  const t = tipo.toLowerCase();
  if (t.includes('full body') || t.includes('ia decide')) return null;
  if (t.includes('superior') || t.includes('inferior')) return 'supinf';
  if (t.includes('push') || t.includes('pull') || t.includes('legs')) return 'ppl';
  if (t.includes('a/b/c/d') || dias >= 4) return dias === 5 ? 'abcde' : 'abcd';
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function filtrarDia(catalogo: any[], filtro: DiaFiltro): any[] {
  return catalogo.filter((e) => {
    const pat = (e.movement_pattern ?? '') as string;
    const grp = ((e.grupo_muscular ?? '') as string).toLowerCase();
    if (CORE_PATTERNS.has(pat)) return false;
    if (filtro.patterns.includes(pat)) return true;
    if (pat === 'outro') return filtro.outro_kws.some((kw) => grp.includes(kw));
    return false;
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function catExToJson(e: any): string {
  return `{"fonte":"catalogo","id":"${e.id}","nome":"${e.nome}","grupo":"${e.grupo_muscular ?? ''}","equip":"${e.equipamento ?? ''}","nivel":"${e.nivel_minimo ?? e.nivel ?? ''}","cat":"${e.categoria ?? ''}","pattern":"${e.movement_pattern ?? ''}"}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildCatalogoSections(catalogo: any[], dias: number, tipo: string): string {
  const splitKey = getSplitKey(dias, tipo);
  const coreExs = dedupPorBase(
    catalogo.filter((e) => CORE_PATTERNS.has((e.movement_pattern ?? '') as string))
  ).slice(0, 8);
  const coreTexto = coreExs.length > 0 ? coreExs.map(catExToJson).join('\n') : '(nenhum)';

  if (!splitKey) {
    const tudo = dedupPorBase(
      catalogo.filter((e) => !CORE_PATTERNS.has((e.movement_pattern ?? '') as string))
    );
    return `=== CATÁLOGO — LISTA GLOBAL (use para todos os treinos) ===
${tudo.map(catExToJson).join('\n')}

--- CORE (disponível em todos os treinos) ---
${coreTexto}`;
  }

  const filtros = SPLIT_MAP[splitKey];
  const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
  const partes: string[] = [];

  for (let i = 0; i < dias; i++) {
    const filtro = filtros[i % filtros.length];
    const exsDoDia = dedupPorBase(filtrarDia(catalogo, filtro));
    partes.push(`--- Treino ${labels[i]}: ${filtro.label} (${exsDoDia.length} exercícios disponíveis) ---
${exsDoDia.map(catExToJson).join('\n')}`);
  }

  return `=== CATÁLOGO DE EXERCÍCIOS — SEÇÕES POR TREINO ===
REGRA CRÍTICA: use APENAS exercícios da seção do SEU treino. Para "Treino B", use SOMENTE o bloco "--- Treino B ---". Nunca use exercícios de outro bloco.

${partes.join('\n\n')}

--- CORE — disponível em TODOS os treinos (máx 1 por rotina) ---
${coreTexto}`;
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
- Treino B: Coxa (coxa, panturrilha)
- Treino C: Superior (Costas e Bíceps — pull)
- Treino D: Bumbum e Posterior (bumbum, parte de trás da perna)`;
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
- Treino A: Superior Push (Peito, Ombros, Tríceps — supino, desenvolvimento, elevações, tríceps)
- Treino B: Coxa (coxa, panturrilha — agachamento, leg press, extensora, panturrilha)
- Treino C: Superior Pull (Costas, Bíceps, Trapézio) — OBRIGATÓRIO: 1 puxada (Barra Fixa ou Puxada Frontal) + 1 remada (Remada Curvada ou Remada na Polia) + roscas reais (Rosca Direta, Alternada ou Martelo). NUNCA use Barra Fixa Supinada como biceps.
- Treino D: Bumbum e Posterior (bumbum, parte de trás da perna — hip thrust, stiff, cadeira flexora, extensão de quadril)
${dias === 5 ? "- Treino E: Superior completo (mix push+pull com exercícios DIFERENTES dos Treinos A e C)" : ""}`;
  }

  if (ppl) {
    return `Divisão Push/Pull/Legs — ${dias} dias:
- Treino A (Push): Peito, Ombros anteriores/médios, Tríceps (supino, desenvolvimento, elevações, tríceps)
- Treino B (Pull): Costas, Bíceps, Ombros posteriores, Trapézio — OBRIGATÓRIO: 1 puxada (Barra Fixa ou Puxada Frontal) + 1 remada (Remada Curvada com Barra ou Remada na Polia) + roscas reais (Rosca Direta, Alternada ou Martelo). NUNCA Barra Fixa Supinada como bíceps.
- Treino C (Legs): coxa, posterior, bumbum, panturrilha (agachamento, leg press, stiff, hip thrust, panturrilha)
${dias >= 4 ? "- Treino D (Push 2): Peito inclinado, Ombros lateral, Tríceps acessórios — exercícios DIFERENTES do Treino A" : ""}
${dias >= 5 ? "- Treino E (Pull 2): Puxada fechada ou neutra, Remada Cavalinho, Rosca Concentrada, Face Pull — exercícios DIFERENTES do Treino B" : ""}
${dias >= 6 ? "- Treino F (Legs 2): Bumbum e Posterior — hip thrust, stiff COM HALTERES (não barra como no C), afundo, extensão de quadril — exercícios DIFERENTES do Treino C" : ""}`;
  }

  if (abcd || dias >= 4) {
    if (dias === 4) {
      return `Divisão A/B/C/D — 4 dias:
- Treino A: Peito e Tríceps (supino reto, supino inclinado, crucifixo, tríceps corda, tríceps testa)
- Treino B: Costas e Bíceps — OBRIGATÓRIO: 1 puxada vertical (Barra Fixa ou Puxada Frontal) + 1 remada (Remada Curvada com Barra, Remada na Polia Baixa ou Remada Cavalinho) + roscas reais (Rosca Direta, Rosca Alternada, Rosca Martelo). NUNCA use Barra Fixa Supinada como exercício de bíceps — ela é puxada de costas.
- Treino C: Coxa e Panturrilha (coxa, panturrilha — agachamento, leg press, extensora, panturrilha)
- Treino D: Ombros, Bumbum e Posterior (desenvolvimento, elevação lateral, hip thrust, stiff, cadeira flexora)`;
    }
    if (dias === 5) {
      return `Divisão A/B/C/D/E — 5 dias (split bodybuilder):
- Treino A: Peito (supino reto, supino inclinado, crucifixo, crossover, peck deck)
- Treino B: Costas (largura + espessura) — OBRIGATÓRIO: 1 puxada vertical (Barra Fixa ou Puxada Frontal) + 2 remadas diferentes (ex: Remada Curvada com Barra + Remada na Polia Baixa) + pullover ou face pull. Costas com apenas Barra Fixa + Terra Romeno = ERRADO.
- Treino C: Bumbum e Posterior (hip thrust, stiff, cadeira flexora, extensão de quadril)
- Treino D: Coxa e Panturrilha (agachamento, leg press, extensora, panturrilha)
- Treino E: Ombros e Braços (desenvolvimento, elevação lateral, rosca direta, rosca alternada, tríceps corda)`;
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

    const limiteCheck = await verificarEIncrementarUsoIA(profId);
    if (!limiteCheck.ok) return { ok: false, error: limiteCheck.error };

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
        .select("id, nome, grupo_muscular, equipamento, nivel, categoria, movement_pattern, contraindicacoes, nivel_minimo")
        .order("nome")
        .limit(700),
    ]);

    const aluno = profileResult.data;
    const anamnese = anamneseResult.data;
    const fotos = fotosResult.data || [];
    const arquivos = arquivosResult.data || [];
    const historico = (historicoResult.data || []) as any[];
    const biblioteca = bibResult.data || [];
    const catalogoBruto = catResult.data || [];

    // Filtrar exercícios contraindicados com base na anamnese do aluno
    const contraindicacoesAluno = extrairContraindicacoesAnamnese(anamnese);
    const catalogo = contraindicacoesAluno.length === 0
      ? catalogoBruto
      : catalogoBruto.filter((e) => {
          const contrEx = (e.contraindicacoes as string[] | null) ?? [];
          return !contrEx.some((c) => contraindicacoesAluno.includes(c));
        });
    if (catalogoBruto.length !== catalogo.length) {
      console.log(`[gerarTreino] ${catalogoBruto.length - catalogo.length} exercícios excluídos por restrições: ${contraindicacoesAluno.join(", ")}`);
    }

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

    const catalogoSections = catalogo.length > 0
      ? buildCatalogoSections(catalogo, config.dias_por_semana, config.tipo_divisao)
      : "=== CATÁLOGO VAZIO ===";

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

${catalogoSections}

=== REGRAS ABSOLUTAS ===
1. O JSON deve ter o campo "rotinas" com um ARRAY de EXATAMENTE ${config.dias_por_semana} objetos.
2. Cada objeto no array "rotinas" é uma SESSÃO DE TREINO DIFERENTE (dia A, dia B, dia C...).
3. NUNCA coloque todos os exercícios em uma única rotina — distribua entre as ${config.dias_por_semana} rotinas.
4. Cada rotina deve ter entre 6 e 10 exercícios DIFERENTES, todos com foco muscular ESPECÍFICO daquele dia.
5. Use APENAS IDs dos exercícios listados acima — nunca invente IDs.
6. Prefira biblioteca do professor. Use catálogo: APENAS exercícios da seção rotulada com seu treino (ex: "Treino B" usa somente o bloco Treino B).
7. Respeite TODAS as restrições, lesões e limitações do aluno.
8. Retorne SOMENTE JSON puro — sem markdown, sem texto, sem \`\`\`.
9. Use linguagem simples e acessível para leigos nos campos "nome" e "foco" de cada rotina. Exemplos: "coxa" (não "quadríceps"), "posterior" ou "parte de trás da perna" (não "isquiotibiais"), "bumbum" (não "glúteo médio" ou "glúteo máximo"), "ombros" (não "deltoides"), "peito" (não "peitoral maior"), "bíceps" (não "bíceps braquial").

=== REGRA ANTI-REPETIÇÃO (CRÍTICA) ===
O catálogo lista variações técnicas como exercícios separados: "Crossover Drop-Set", "Crossover Rest-Pause", "Crossover Isometria" etc.
Estas são VARIAÇÕES DO MESMO MOVIMENTO — NÃO são exercícios diferentes.

PROIBIDO em uma mesma rotina:
- 2 ou mais variações do mesmo aparelho/movimento (ex: Crossover Polia Alta + Crossover Polia Baixa + Crossover Drop-Set = 3 crossovers = ERRADO)
- 2 ou mais Hip Thrust (barra, máquina, rest-pause etc = todos são Hip Thrust = escolha 1)
- 2 ou mais Cadeira Extensora (drop-set, 1½ rep, isometria etc = todas são Extensora = escolha 1)
- 2 ou mais Leg Press (45° + drop-set + unilateral etc = todos são Leg Press = escolha 1)
- 2 ou mais Face Pull
- Barra Fixa Pronada + Barra Fixa Supinada = mesmo padrão de puxada vertical, grip diferente = escolha 1 (pronada ou supinada, nunca as duas no mesmo dia)
- Puxada Frontal Aberta + Puxada Frontal Fechada + Puxada Neutra = mesmo movimento = escolha 1

REGRA: para cada padrão de movimento, escolha UM exercício. Se quiser usar técnica especial (drop-set, rest-pause), aplique ao exercício escolhido via "observacao".
EXEMPLO CORRETO: {"nome": "Crossover na Polia Alta", "series": 4, "repeticoes": "10-12", "observacao": "Última série em drop-set: reduzir 20% e continuar até a falha."}
EXEMPLO ERRADO: listar "Crossover Drop-Set" + "Crossover Rest-Pause" + "Crossover Isometria" como 3 exercícios separados.

=== REGRA DE NÃO-REPETIÇÃO ENTRE DIAS (CRÍTICA) ===
O mesmo exercício NUNCA pode aparecer em mais de 1 rotina do mesmo plano.

PROIBIDO:
- Terra Romeno no Treino B E também no Treino C = ERRADO
- Agachamento no Treino A E também no Treino D = ERRADO
- Hip Thrust no Treino B E também no Treino E = ERRADO

CORRETO: cada exercício aparece em NO MÁXIMO 1 rotina de todo o plano.
Se um grupo muscular treina 2x/semana, use exercícios DIFERENTES em cada dia:
- Treino B (isquio): Terra Romeno com Barra → Treino E (isquio): Stiff com Halteres (exercícios diferentes)
- Treino A (glúteo): Hip Thrust → Treino D (glúteo): Avanço + Extensão de Quadril no Cabo (exercícios diferentes)

=== GUIA DE GRUPOS MUSCULARES ===
COSTAS: dia de costas OBRIGATORIAMENTE tem puxada vertical (Barra Fixa ou Puxada Frontal) + pelo menos 1 remada horizontal (Remada Curvada com Barra, Remada na Polia Baixa, Remada Cavalinho, Remada Unilateral). Costas com apenas Barra Fixa + Terra Romeno e zero remadas = ERRADO GRAVE.
BÍCEPS: use roscas reais — Rosca Direta com Barra, Rosca Alternada com Halteres, Rosca Martelo, Rosca Concentrada, Rosca Scott, Rosca 21. NUNCA use Barra Fixa Supinada como exercício de bíceps — ela é puxada vertical de costas, não rosca de bíceps.
GLÚTEOS/ISQUIO: Terra Romeno e Stiff são exercícios distintos — se um aparece em um dia, o outro pode aparecer em outro dia. Mas o mesmo exercício (Terra Romeno) não pode aparecer 2 vezes no plano.
OMBROS: composto = Desenvolvimento com Barra ou Halteres. Isoladores = Elevação Lateral, Elevação Frontal, Face Pull (posterior). Face Pull é ombro posterior — não coloque em dia de peito.

=== ESTRUTURA OBRIGATÓRIA POR ROTINA ===
Cada rotina DEVE seguir esta sequência de padrões de movimento distintos:
1. COMPOSTO PRINCIPAL: 1 exercício multiarticular pesado (agachamento, supino, terra, desenvolvimento, puxada, remada)
2. COMPOSTO SECUNDÁRIO: 1 exercício multiarticular de suporte (variação de ângulo diferente do principal)
3. ISOLADOR A: 1 exercício monoarticular para músculo principal
4. ISOLADOR B: 1 exercício monoarticular para músculo secundário/sinérgico
5. ISOLADOR C (opcional): 1 exercício diferente dos anteriores
6. ISOLADOR D (opcional): 1 exercício diferente dos anteriores
7. FINALIZADOR/PUMP: 1 exercício leve para congestão final
8. CORE (opcional): 1 exercício abdominal/estabilização

Total: 6 a 9 exercícios por rotina, TODOS com padrões de movimento distintos entre si.

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

    // 8. Validar IDs e corrigir nomes — a IA às vezes usa o ID certo mas o nome errado
    // (ex: usa o ID do Agachamento mas chama de "Supino Reto")
    // O nome real do catálogo/biblioteca sempre prevalece sobre o nome que a IA inventou.
    const bibMap = new Map(biblioteca.map((e) => [e.id, e.nome]));
    const catMap = new Map(catalogo.map((e) => [e.id, e.nome]));

    treino.rotinas = treino.rotinas.map((rotina) => ({
      ...rotina,
      exercicios: (rotina.exercicios || [])
        .filter((ex) => {
          if (ex.fonte === "biblioteca") return bibMap.has(ex.exercicio_id);
          if (ex.fonte === "catalogo") return catMap.has(ex.exercicio_id);
          return false;
        })
        .map((ex) => {
          const nomeReal =
            ex.fonte === "biblioteca"
              ? bibMap.get(ex.exercicio_id)
              : catMap.get(ex.exercicio_id);
          return nomeReal ? { ...ex, nome: nomeReal } : ex;
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
    console.error("[gerarTreino] erro após consumir 1 geração de IA:", msg);
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

    try {
      const { data: prof } = await supabaseAdmin
        .from("profiles").select("nome_completo").eq("id", profId).single();
      await criarNotificacao({
        destinatario_id: alunoId,
        tipo: "treino_novo",
        titulo: "Você tem um novo treino!",
        mensagem: `${prof?.nome_completo || "Seu professor"} criou um novo plano de treino para você`,
        referencia_id: treinoRow.id,
        referencia_tipo: "treino",
      });
    } catch { /* notificação é best-effort */ }

    return { ok: true, treinoId: treinoRow.id };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Erro ao salvar treino." };
  }
}

// ─── Action: gerar treino-modelo com IA (sem dados de aluno específico) ────────

export async function gerarTreinoModeloComIA(
  profId: string,
  config: ConfigTreino
): Promise<GerarTreinoResult> {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { ok: false, error: "ANTHROPIC_API_KEY não configurado." };

    const limiteCheck = await verificarEIncrementarUsoIA(profId);
    if (!limiteCheck.ok) return { ok: false, error: limiteCheck.error };

    const [bibResult, catResult] = await Promise.all([
      supabaseAdmin
        .from("exercicios")
        .select("id, nome, descricao")
        .eq("professor_id", profId)
        .order("nome"),

      supabaseAdmin
        .from("exercicios_catalogo")
        .select("id, nome, grupo_muscular, equipamento, nivel, categoria, movement_pattern, contraindicacoes, nivel_minimo")
        .order("nome")
        .limit(700),
    ]);

    const biblioteca = bibResult.data || [];
    const catalogo = catResult.data || [];

    const bibTexto =
      biblioteca.length > 0
        ? biblioteca
            .map(
              (e) =>
                `{"fonte":"biblioteca","id":"${e.id}","nome":"${e.nome}"${e.descricao ? `,"desc":"${e.descricao.slice(0, 80)}"` : ""}}`
            )
            .join("\n")
        : "Biblioteca vazia.";

    const catalogoSections = catalogo.length > 0
      ? buildCatalogoSections(catalogo, config.dias_por_semana, config.tipo_divisao)
      : "=== CATÁLOGO VAZIO ===";

    const guiaDivisao = buildGuiaDivisao(config.dias_por_semana, config.tipo_divisao);

    const perfilTexto = config.perfil_modelo?.trim() || "Sem perfil especificado.";

    const promptTexto = `Você é um personal trainer especializado em periodização. Sua tarefa é criar um PLANO DE TREINO MODELO (template reutilizável) com MÚLTIPLAS ROTINAS DIÁRIAS.

Este é um TREINO-MODELO, não vinculado a um aluno específico. Baseie-se apenas no perfil do aluno-tipo descrito abaixo.

=== PERFIL DO ALUNO-TIPO ===
${perfilTexto}

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

${catalogoSections}

=== REGRAS ABSOLUTAS ===
1. O JSON deve ter o campo "rotinas" com um ARRAY de EXATAMENTE ${config.dias_por_semana} objetos.
2. Cada objeto no array "rotinas" é uma SESSÃO DE TREINO DIFERENTE (dia A, dia B, dia C...).
3. NUNCA coloque todos os exercícios em uma única rotina — distribua entre as ${config.dias_por_semana} rotinas.
4. Cada rotina deve ter entre 6 e 10 exercícios DIFERENTES, todos com foco muscular ESPECÍFICO daquele dia.
5. Use APENAS IDs dos exercícios listados acima — nunca invente IDs.
6. Prefira biblioteca do professor. Use catálogo: APENAS exercícios da seção rotulada com seu treino (ex: "Treino B" usa somente o bloco Treino B).
7. Respeite o perfil descrito (limitações, objetivos, nível).
8. Retorne SOMENTE JSON puro — sem markdown, sem texto, sem \`\`\`.
9. Use linguagem simples e acessível para leigos nos campos "nome" e "foco" de cada rotina. Exemplos: "coxa" (não "quadríceps"), "posterior" ou "parte de trás da perna" (não "isquiotibiais"), "bumbum" (não "glúteo médio" ou "glúteo máximo"), "ombros" (não "deltoides"), "peito" (não "peitoral maior"), "bíceps" (não "bíceps braquial").

=== REGRA ANTI-REPETIÇÃO (CRÍTICA) ===
O catálogo lista variações técnicas como exercícios separados: "Crossover Drop-Set", "Crossover Rest-Pause", "Crossover Isometria" etc.
Estas são VARIAÇÕES DO MESMO MOVIMENTO — NÃO são exercícios diferentes.

PROIBIDO em uma mesma rotina:
- 2 ou mais variações do mesmo aparelho/movimento (ex: Crossover Polia Alta + Crossover Polia Baixa + Crossover Drop-Set = 3 crossovers = ERRADO)
- 2 ou mais Hip Thrust (barra, máquina, rest-pause etc = todos são Hip Thrust = escolha 1)
- 2 ou mais Cadeira Extensora (drop-set, 1½ rep, isometria etc = todas são Extensora = escolha 1)
- 2 ou mais Leg Press (45° + drop-set + unilateral etc = todos são Leg Press = escolha 1)
- 2 ou mais Face Pull
- Barra Fixa Pronada + Barra Fixa Supinada = mesmo padrão de puxada vertical, grip diferente = escolha 1
- Puxada Frontal Aberta + Puxada Frontal Fechada + Puxada Neutra = mesmo movimento = escolha 1

REGRA: para cada padrão de movimento, escolha UM exercício. Se quiser usar técnica especial (drop-set, rest-pause), aplique ao exercício escolhido via "observacao".

=== REGRA DE NÃO-REPETIÇÃO ENTRE DIAS (CRÍTICA) ===
O mesmo exercício NUNCA pode aparecer em mais de 1 rotina do mesmo plano.

=== GUIA DE GRUPOS MUSCULARES ===
COSTAS: dia de costas OBRIGATORIAMENTE tem puxada vertical (Barra Fixa ou Puxada Frontal) + pelo menos 1 remada horizontal. Costas com apenas Barra Fixa + Terra Romeno e zero remadas = ERRADO GRAVE.
BÍCEPS: use roscas reais — Rosca Direta com Barra, Rosca Alternada com Halteres, Rosca Martelo, Rosca Concentrada, Rosca Scott, Rosca 21. NUNCA use Barra Fixa Supinada como exercício de bíceps.
GLÚTEOS/ISQUIO: Terra Romeno e Stiff são exercícios distintos. Mas o mesmo exercício não pode aparecer 2 vezes no plano.
OMBROS: composto = Desenvolvimento com Barra ou Halteres. Isoladores = Elevação Lateral, Elevação Frontal, Face Pull (posterior).

=== ESTRUTURA OBRIGATÓRIA POR ROTINA ===
Cada rotina DEVE seguir esta sequência de padrões de movimento distintos:
1. COMPOSTO PRINCIPAL: 1 exercício multiarticular pesado
2. COMPOSTO SECUNDÁRIO: 1 exercício multiarticular de suporte
3. ISOLADOR A: 1 exercício monoarticular para músculo principal
4. ISOLADOR B: 1 exercício monoarticular para músculo secundário/sinérgico
5. ISOLADOR C (opcional): 1 exercício diferente dos anteriores
6. ISOLADOR D (opcional): 1 exercício diferente dos anteriores
7. FINALIZADOR/PUMP: 1 exercício leve para congestão final
8. CORE (opcional): 1 exercício abdominal/estabilização

Total: 6 a 9 exercícios por rotina, TODOS com padrões de movimento distintos entre si.

=== FORMATO EXATO DO JSON (obrigatório) ===
{
  "nome": "Modelo [Tipo de Divisão] — [resumo do perfil em 3-5 palavras]",
  "descricao": "Descrição do modelo e para qual perfil de aluno é indicado",
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
    }
  ]
}

ATENÇÃO: O exemplo acima mostra 1 rotina, mas você DEVE criar EXATAMENTE ${config.dias_por_semana} rotinas (uma por dia de treino).`;

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system:
        "Você é um personal trainer especializado em periodização. Responda SEMPRE com JSON puro e válido, sem texto adicional, sem markdown, sem explicações. Apenas o objeto JSON conforme solicitado.",
      messages: [{ role: "user", content: promptTexto }],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";

    const jsonStr = extrairJSON(rawText);
    if (!jsonStr) {
      console.error("[gerarModelo] resposta sem JSON:", rawText.slice(0, 300));
      return { ok: false, error: "A IA não retornou um JSON válido. Tente novamente." };
    }

    let treino: TreinoGerado;
    try {
      treino = JSON.parse(jsonStr) as TreinoGerado;
    } catch (parseErr: any) {
      console.error("[gerarModelo] JSON inválido:", jsonStr.slice(0, 300), parseErr?.message);
      return { ok: false, error: "A IA retornou um JSON malformado. Tente novamente." };
    }

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

    const bibMap = new Map(biblioteca.map((e) => [e.id, e.nome]));
    const catMap = new Map(catalogo.map((e) => [e.id, e.nome]));

    treino.rotinas = treino.rotinas.map((rotina) => ({
      ...rotina,
      exercicios: (rotina.exercicios || [])
        .filter((ex) => {
          if (ex.fonte === "biblioteca") return bibMap.has(ex.exercicio_id);
          if (ex.fonte === "catalogo") return catMap.has(ex.exercicio_id);
          return false;
        })
        .map((ex) => {
          const nomeReal =
            ex.fonte === "biblioteca"
              ? bibMap.get(ex.exercicio_id)
              : catMap.get(ex.exercicio_id);
          return nomeReal ? { ...ex, nome: nomeReal } : ex;
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
    console.error("[gerarModelo] erro após consumir 1 geração de IA:", msg);
    return { ok: false, error: msg };
  }
}

// ─── Action: salvar treino-modelo ─────────────────────────────────────────────

export async function salvarTreinoModelo(
  profId: string,
  treino: TreinoGerado,
  perfilOrigem?: string
): Promise<SalvarTreinoResult> {
  try {
    const { data: treinoRow, error: treinoErr } = await supabaseAdmin
      .from("treinos")
      .insert({
        nome: treino.nome,
        descricao: treino.descricao,
        aluno_id: null,
        professor_id: profId,
        dificuldade: treino.nivel,
        objetivo: treino.descricao,
        gerado_por_ia: true,
        is_template: true,
        perfil_origem: perfilOrigem ?? null,
      })
      .select("id")
      .single();

    if (treinoErr || !treinoRow) throw treinoErr ?? new Error("Erro ao criar modelo.");

    for (const rotina of treino.rotinas) {
      const { data: rotinaRow, error: rotinaErr } = await supabaseAdmin
        .from("rotinas_diarias")
        .insert({
          plano_id: treinoRow.id,
          nome: rotina.nome,
          descricao: rotina.foco || null,
          aluno_id: null,
        })
        .select("id")
        .single();

      if (rotinaErr || !rotinaRow) throw rotinaErr ?? new Error(`Erro ao criar rotina "${rotina.nome}".`);

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
    return { ok: false, error: e?.message ?? "Erro ao salvar modelo." };
  }
}

// ─── Action: atribuir modelo a um aluno (cópia) ───────────────────────────────

export type AtribuirModeloResult =
  | { ok: true; treinoId: string }
  | { ok: false; error: string };

export async function atribuirModeloAoAluno(
  modeloId: string,
  alunoId: string,
  profId: string
): Promise<AtribuirModeloResult> {
  try {
    const [modeloResult, alunoResult] = await Promise.all([
      supabaseAdmin
        .from("treinos")
        .select("nome, descricao, dificuldade, objetivo")
        .eq("id", modeloId)
        .eq("professor_id", profId)
        .eq("is_template", true)
        .single(),

      supabaseAdmin
        .from("profiles")
        .select("nome_completo")
        .eq("id", alunoId)
        .single(),
    ]);

    if (modeloResult.error || !modeloResult.data)
      throw new Error("Modelo não encontrado.");
    if (alunoResult.error || !alunoResult.data)
      throw new Error("Aluno não encontrado.");

    const modelo = modeloResult.data;
    const nomeAluno = alunoResult.data.nome_completo || "Aluno";
    const nomeCopia = `${modelo.nome} — ${nomeAluno}`;

    const { data: novoTreino, error: treinoErr } = await supabaseAdmin
      .from("treinos")
      .insert({
        nome: nomeCopia,
        descricao: modelo.descricao,
        aluno_id: alunoId,
        professor_id: profId,
        dificuldade: modelo.dificuldade,
        objetivo: modelo.objetivo,
        gerado_por_ia: true,
        is_template: false,
        template_origem_id: modeloId,
      })
      .select("id")
      .single();

    if (treinoErr || !novoTreino) throw treinoErr ?? new Error("Erro ao criar cópia do modelo.");

    const { data: rotinas, error: rotinasErr } = await supabaseAdmin
      .from("rotinas_diarias")
      .select("id, nome, descricao")
      .eq("plano_id", modeloId)
      .order("created_at");

    if (rotinasErr) throw rotinasErr;

    for (const rotina of rotinas || []) {
      const { data: novaRotina, error: novaRotinaErr } = await supabaseAdmin
        .from("rotinas_diarias")
        .insert({
          plano_id: novoTreino.id,
          nome: rotina.nome,
          descricao: rotina.descricao,
          aluno_id: alunoId,
        })
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

      const rows = exercicios.map((ex) => ({
        rotina_id: novaRotina.id,
        exercicio_id: ex.exercicio_id,
        catalogo_id: ex.catalogo_id,
        ordem: ex.ordem,
        series: ex.series,
        repeticoes: ex.repeticoes,
        intervalo: ex.intervalo,
        observacoes: ex.observacoes,
      }));

      const { error: insertErr } = await supabaseAdmin
        .from("treino_exercicios")
        .insert(rows);

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

    return { ok: true, treinoId: novoTreino.id };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Erro ao atribuir modelo." };
  }
}

// ─── Action: revisar treino com IA ────────────────────────────────────────────

export type RevisaoErro = {
  rotina: string;
  descricao: string;
  gravidade: "grave" | "moderado" | "leve";
};

export type RevisaoSugestaoNome = {
  rotina_id: string;
  nome_atual: string;
  nome_sugerido: string;
};

export type RevisaoTreino = {
  nota: number;
  resumo: string;
  pontos_positivos: string[];
  erros: RevisaoErro[];
  sugestoes_nomes: RevisaoSugestaoNome[];
  recomendacoes: string[];
};

export type RevisarTreinoResult =
  | { ok: true; revisao: RevisaoTreino }
  | { ok: false; error: string };

export async function revisarTreinoComIA(
  treinoId: string,
  profId: string
): Promise<RevisarTreinoResult> {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { ok: false, error: "ANTHROPIC_API_KEY não configurado." };

    const limiteCheck = await verificarEIncrementarUsoIA(profId, "revisao");
    if (!limiteCheck.ok) return { ok: false, error: limiteCheck.error };

    // 1. Buscar treino
    const { data: treino } = await supabaseAdmin
      .from("treinos")
      .select("id, nome, descricao")
      .eq("id", treinoId)
      .eq("professor_id", profId)
      .single();

    if (!treino) return { ok: false, error: "Treino não encontrado." };

    // 2. Buscar rotinas
    const { data: rotinas } = await supabaseAdmin
      .from("rotinas_diarias")
      .select("id, nome, descricao")
      .eq("plano_id", treinoId)
      .order("nome");

    if (!rotinas || rotinas.length === 0)
      return { ok: false, error: "Nenhuma rotina encontrada." };

    // 3. Buscar exercícios com nomes resolvidos
    const rotinaIds = rotinas.map((r) => r.id);
    const { data: exerciciosRaw } = await supabaseAdmin
      .from("treino_exercicios")
      .select("rotina_id, ordem, series, repeticoes, intervalo, observacoes, exercicio_id, catalogo_id")
      .in("rotina_id", rotinaIds)
      .order("ordem");

    const catIds = (exerciciosRaw || []).filter((e) => e.catalogo_id).map((e) => e.catalogo_id as string);
    const bibIds = (exerciciosRaw || []).filter((e) => e.exercicio_id).map((e) => e.exercicio_id as string);

    const [catRes, bibRes] = await Promise.all([
      catIds.length > 0
        ? supabaseAdmin.from("exercicios_catalogo").select("id, nome, grupo_muscular, movement_pattern").in("id", catIds)
        : Promise.resolve({ data: [] }),
      bibIds.length > 0
        ? supabaseAdmin.from("exercicios").select("id, nome").in("id", bibIds)
        : Promise.resolve({ data: [] }),
    ]);

    const catMap = new Map(
      ((catRes.data || []) as any[]).map((e) => [e.id, { nome: e.nome as string, grupo: (e.grupo_muscular || "") as string, pattern: (e.movement_pattern || "") as string }])
    );
    const bibMap = new Map(((bibRes.data || []) as any[]).map((e) => [e.id, e.nome as string]));

    // 4. Montar estrutura legível para o prompt
    const estrutura = rotinas
      .map((rotina) => {
        const exs = (exerciciosRaw || [])
          .filter((e) => e.rotina_id === rotina.id)
          .map((e) => {
            const info = e.catalogo_id ? catMap.get(e.catalogo_id) : null;
            const nome = info?.nome || (e.exercicio_id ? bibMap.get(e.exercicio_id) : null) || "Exercício";
            const grupo = info?.grupo ? ` [${info.grupo}]` : "";
            return `  ${e.ordem}. ${nome}${grupo} — ${e.series}x${e.repeticoes}${e.intervalo ? `, descanso: ${e.intervalo}` : ""}${e.observacoes ? `, obs: ${e.observacoes}` : ""}`;
          });
        return `## ${rotina.nome}${rotina.descricao ? `\nFoco: ${rotina.descricao}` : ""}\n${exs.join("\n") || "  (sem exercícios)"}`;
      })
      .join("\n\n");

    // 5. Prompt de revisão
    const prompt = `Você é um personal trainer especializado em análise e revisão crítica de treinos. Analise o plano abaixo com rigor técnico.

=== PLANO DE TREINO ===
Nome: ${treino.nome}
${treino.descricao ? `Descrição: ${treino.descricao}` : ""}

${estrutura}

=== O QUE VERIFICAR ===
- Equilíbrio entre grupos musculares e volume por dia
- Repetição do mesmo exercício em dias diferentes (ERRO GRAVE)
- 2 ou mais variações do mesmo movimento na mesma rotina (ex: 2 tipos de crossover, 2 leg press — ERRO GRAVE)
- Dia de costas sem puxada vertical + remada horizontal (ERRO GRAVE)
- Barra Fixa Supinada usada como exercício de bíceps (ERRO GRAVE)
- Ordens de exercícios inadequadas (ex: isolador antes de composto)
- Nomes de rotinas com termos técnicos que um leigo não entende
- Grupos musculares não treinados ou desequilíbrios agonista/antagonista

=== SUGESTÕES DE NOMES ===
Indique APENAS rotinas cujo nome tem termos técnicos para substituir por linguagem de leigo.
Exemplos: "quadríceps" → "coxa", "isquiotibiais" → "posterior" ou "parte de trás da perna", "glúteos" → "bumbum", "deltoides" → "ombros", "peitoral" → "peito", "bíceps braquial" → "bíceps".

IDs exatos das rotinas (use estes IDs no campo rotina_id):
${rotinas.map((r) => `- "${r.id}" → "${r.nome}"`).join("\n")}

=== RETORNE ESTE JSON EXATO ===
{
  "nota": 8,
  "resumo": "1-2 frases sobre o plano geral",
  "pontos_positivos": ["ponto 1", "ponto 2"],
  "erros": [
    { "rotina": "Treino B", "descricao": "descrição clara do erro", "gravidade": "grave" }
  ],
  "sugestoes_nomes": [
    { "rotina_id": "uuid-exato", "nome_atual": "nome atual", "nome_sugerido": "nome em linguagem simples" }
  ],
  "recomendacoes": ["recomendação 1", "recomendação 2"]
}

Retorne SOMENTE o JSON, sem texto adicional.`;

    // 6. Chamar Claude
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: "Você é um personal trainer especializado. Responda SEMPRE com JSON puro e válido, sem texto adicional, sem markdown.",
      messages: [{ role: "user", content: prompt }],
    });

    const rawText = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonStr = extrairJSON(rawText);
    if (!jsonStr) return { ok: false, error: "A IA não retornou um JSON válido." };

    const revisao = JSON.parse(jsonStr) as RevisaoTreino;
    return { ok: true, revisao };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Erro ao revisar treino." };
  }
}
