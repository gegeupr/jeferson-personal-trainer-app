// Sobe os 936 GIFs pro bucket privado 'exercicio-gifs' e popula a tabela
// exercicio_gifs com nome + categoria (do classify-report.json já gerado).
// Idempotente: pula arquivos que já existem na tabela.

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const GIFS_DIR = "C:\\Users\\ACER\\Downloads\\gif treinos";
const BUCKET = "exercicio-gifs";

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

// Storage do Supabase rejeita chaves com acento/caractere especial.
// Mantemos o nome original (com acento) só no banco, pra exibição/busca.
function slugify(nomeArquivo) {
  const semExt = nomeArquivo.replace(/\.gif$/i, "");
  const slug = semExt
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return slug;
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const classificacao = require("./classify-report.json");
  const categoriaPorArquivo = new Map(
    classificacao.map((c) => [c.arquivo, c.categoria])
  );

  const { data: existentes } = await supabase
    .from("exercicio_gifs")
    .select("nome_arquivo");
  const jaExistem = new Set((existentes ?? []).map((e) => e.nome_arquivo));

  const arquivos = fs
    .readdirSync(GIFS_DIR)
    .filter((f) => f.toLowerCase().endsWith(".gif"));

  let enviados = 0;
  let pulados = 0;
  let erros = 0;
  const slugsUsados = new Set();

  for (const arquivo of arquivos) {
    if (jaExistem.has(arquivo)) {
      pulados++;
      continue;
    }

    const caminhoLocal = path.join(GIFS_DIR, arquivo);
    const bytes = fs.readFileSync(caminhoLocal);

    let slug = slugify(arquivo);
    let storagePath = `${slug}.gif`;
    let n = 2;
    while (slugsUsados.has(storagePath)) {
      storagePath = `${slug}-${n}.gif`;
      n++;
    }
    slugsUsados.add(storagePath);

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, bytes, { contentType: "image/gif", upsert: false });

    if (uploadErr) {
      console.error(`Erro upload "${arquivo}": ${uploadErr.message}`);
      erros++;
      continue;
    }

    const { error: insertErr } = await supabase.from("exercicio_gifs").insert({
      nome_arquivo: arquivo,
      storage_path: storagePath,
      grupo_muscular_amplo: categoriaPorArquivo.get(arquivo) ?? "Não classificado",
    });

    if (insertErr) {
      console.error(`Erro insert "${arquivo}": ${insertErr.message}`);
      erros++;
      continue;
    }

    enviados++;
    if (enviados % 50 === 0) console.log(`${enviados} enviados...`);
  }

  console.log(`\nConcluído. Enviados: ${enviados} | Já existiam: ${pulados} | Erros: ${erros}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
