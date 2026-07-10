// Aplica os matches de alta confiança (score >= 0.5) do match-report.json,
// ligando exercicios_catalogo.gif_id ao exercicio_gifs correspondente.

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

const LIMIAR_CONFIANCA = 0.5;

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const relatorio = require("./match-report.json");
  const candidatos = relatorio.filter(
    (r) => r.gif_sugerido && r.confianca >= LIMIAR_CONFIANCA
  );

  const { data: gifs, error: gifsErr } = await supabase
    .from("exercicio_gifs")
    .select("id, nome_arquivo");
  if (gifsErr) throw gifsErr;

  const gifPorNome = new Map(gifs.map((g) => [g.nome_arquivo, g.id]));

  let aplicados = 0;
  let semGifNaTabela = 0;
  let erros = 0;

  for (const item of candidatos) {
    const gifId = gifPorNome.get(item.gif_sugerido);
    if (!gifId) {
      console.warn(`Sem gif na tabela: "${item.gif_sugerido}" (catálogo: ${item.catalogo_nome})`);
      semGifNaTabela++;
      continue;
    }

    const { error } = await supabase
      .from("exercicios_catalogo")
      .update({ gif_id: gifId })
      .eq("id", item.catalogo_id);

    if (error) {
      console.error(`Erro em "${item.catalogo_nome}": ${error.message}`);
      erros++;
      continue;
    }
    aplicados++;
  }

  console.log(`\nCandidatos (score >= ${LIMIAR_CONFIANCA}): ${candidatos.length}`);
  console.log(`Aplicados: ${aplicados}`);
  console.log(`Sem gif correspondente na tabela: ${semGifNaTabela}`);
  console.log(`Erros: ${erros}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
