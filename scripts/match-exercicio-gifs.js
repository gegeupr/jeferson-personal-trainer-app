// Script único (não faz parte do app) — compara os nomes dos GIFs locais
// com o catálogo de exercícios e gera um relatório de match por confiança.
// Não sobe nada no Storage, não altera o banco. Só leitura + relatório.

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function carregarEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  const conteudo = fs.readFileSync(envPath, "utf-8");
  for (const linha of conteudo.split("\n")) {
    const l = linha.trim();
    if (!l || l.startsWith("#")) continue;
    const idx = l.indexOf("=");
    if (idx === -1) continue;
    const chave = l.slice(0, idx).trim();
    const valor = l.slice(idx + 1).trim();
    if (!process.env[chave]) process.env[chave] = valor;
  }
}
carregarEnvLocal();

const GIFS_DIR = "C:\\Users\\ACER\\Downloads\\gif treinos";
const OUTPUT_PATH = path.join(__dirname, "match-report.json");

// Modificadores de técnica de treino — removidos do nome antes de comparar,
// pois não mudam o gesto do exercício (Agachamento Drop-Set == Agachamento).
const TECNICA_REGEX =
  /\((drop-set|rest-pause|tempo\s*[\d-]+|isometria[^)]*|amplitude parcial|pausas?[^)]*|1 e 1\/2 repeti[çc][ãa]o|unilateral)\)/gi;

function normalizar(s) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\.[^/.]+$/, "") // remove extensão
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extrairNomeBase(nomeCatalogo) {
  const semTecnica = nomeCatalogo.replace(TECNICA_REGEX, "").trim();
  return normalizar(semTecnica);
}

const STOPWORDS = new Set(["com", "de", "da", "do", "na", "no", "em", "e", "para", "a", "o", "as", "os", "1"]);

function tokens(s) {
  return s.split(" ").filter((t) => t && !STOPWORDS.has(t));
}

// Exige que a palavra-núcleo (primeiro token relevante — "agachamento",
// "abdominal", "puxada"...) seja idêntica entre catálogo e GIF. Depois,
// entre os candidatos com núcleo igual, prefere o que tem MENOS palavras
// extras não explicadas (ex.: "búlgaro" quando o catálogo não pede isso) —
// evita casar "Agachamento (Halteres)" com "Agachamento Búlgaro (Halteres)".
function melhorCandidato(nomeBaseAlvo, candidatos) {
  const tokensAlvo = tokens(nomeBaseAlvo);
  if (tokensAlvo.length === 0) return { gif: null, score: 0 };

  const nucleo = tokensAlvo[0];
  const restoAlvo = new Set(tokensAlvo.slice(1));

  let melhor = null;
  let melhorExtras = Infinity;
  let melhorOverlap = -1;

  for (const cand of candidatos) {
    const tokensCand = tokens(cand.norm);
    if (tokensCand.length === 0 || tokensCand[0] !== nucleo) continue;

    const restoCand = tokensCand.slice(1);
    const overlap = restoCand.filter((t) => restoAlvo.has(t)).length;
    const extras = restoCand.filter((t) => !restoAlvo.has(t)).length;

    if (extras < melhorExtras || (extras === melhorExtras && overlap > melhorOverlap)) {
      melhor = cand;
      melhorExtras = extras;
      melhorOverlap = overlap;
    }
  }

  if (!melhor) return { gif: null, score: 0 };

  const totalAlvo = restoAlvo.size;
  const score =
    totalAlvo === 0 && melhorExtras === 0
      ? 1
      : (melhorOverlap + 1) / (melhorOverlap + melhorExtras + 1); // +1 pelo núcleo batido

  return { gif: melhor.arquivo, score: Math.round(score * 100) / 100 };
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const gifFiles = fs
    .readdirSync(GIFS_DIR)
    .filter((f) => f.toLowerCase().endsWith(".gif"));

  const gifsNormalizados = gifFiles.map((f) => ({
    arquivo: f,
    norm: normalizar(f),
  }));

  const { data: catalogo, error } = await supabase
    .from("exercicios_catalogo")
    .select("id, nome")
    .order("nome");

  if (error) throw error;

  const relatorio = [];

  for (const item of catalogo) {
    const nomeBase = extrairNomeBase(item.nome);
    const { gif, score } = melhorCandidato(nomeBase, gifsNormalizados);

    relatorio.push({
      catalogo_id: item.id,
      catalogo_nome: item.nome,
      nome_base_normalizado: nomeBase,
      gif_sugerido: gif,
      confianca: score,
    });
  }

  relatorio.sort((a, b) => a.confianca - b.confianca);

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(relatorio, null, 2), "utf-8");

  const semMatch = relatorio.filter((r) => r.confianca === 0).length;
  const baixaConfianca = relatorio.filter((r) => r.confianca > 0 && r.confianca < 0.5).length;
  const altaConfianca = relatorio.filter((r) => r.confianca >= 0.5).length;

  console.log(`Total catálogo: ${relatorio.length}`);
  console.log(`Total GIFs: ${gifFiles.length}`);
  console.log(`Sem nenhum match: ${semMatch}`);
  console.log(`Confiança baixa (<0.5): ${baixaConfianca}`);
  console.log(`Confiança alta (>=0.5): ${altaConfianca}`);
  console.log(`Relatório completo salvo em: ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
