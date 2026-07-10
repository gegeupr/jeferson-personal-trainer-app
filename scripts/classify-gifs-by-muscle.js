// Classifica os 936 GIFs por grupo muscular amplo, usando palavras-chave
// no nome do arquivo. Não escreve no banco — só gera relatório pra revisão.

const fs = require("fs");
const path = require("path");

const GIFS_DIR = "C:\\Users\\ACER\\Downloads\\gif treinos";
const OUTPUT_PATH = path.join(__dirname, "classify-report.json");

function normalizar(s) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// Ordem importa: regras mais específicas primeiro (ex.: "tríceps" antes de
// "rosca", pra "tríceps corda" não cair em Bíceps por causa de outra palavra).
// 3o elemento (opcional) = termos de exclusão: se presentes, a regra é pulada
// mesmo com termo batendo (ex.: "flexão" bate Peito, mas "flexão de punho" não é).
const REGRAS = [
  ["Mobilidade", ["alongamento", "mobilidade", "alongar", "postura do arco", "postura da esfinge", "rolo de espuma", "foam roll"]],
  ["Funcional", [
    "arranco", "arremesso", "clean", "power clean", "snatch", "burpee",
    "corda de batalha", "battle rope", "boxe", "jab", "cruzado", "chute",
    "caminhada", "andar de", "caminhar", "corrida", "sprint",
    "wall walk", "bandeira humana", "back lever", "sled", "farmer walk",
    "sandbag", "zercher", "carregamento", "kettlebell", "medicine ball",
    "medicina bola", "bola de reação", "battle", "agilidade",
    "polichinelo", "pular corda", "salto", "saltos", "patinador",
    "pliométrico", "pliometrico", "snap jump", "impulso", "exercício pliométrico",
    "muscle up", "rastejo", "urso", "bear crawl", "turco", "wall sit",
    "swimming", "socos", "esquiador",
  ]],
  ["Panturrilha", ["panturrilha", "gemeos", "sóleo", "solear"]],
  ["Tríceps", ["tríceps", "triceps", "testa", "francês", "mergulho", "dips", "coice de tríceps", "paralelas"]],
  ["Bíceps", ["rosca", "bíceps", "biceps", "scott"]],
  ["Ombro", [
    "desenvolvimento", "elevação lateral", "elevação frontal", "arnold",
    "manguito", "encolhimento", "face pull", "rotação externa", "rotação interna",
    "círculos com os braços", "círculos de braço", "elevação de t", "elevação em t",
    "elevação em y", "manguito rotador",
    // deltoide (qualquer porção) checado ANTES de Peito — "voador"/"crucifixo"
    // de deltoide posterior não é exercício de peito, é ombro.
    "deltoide posterior", "deltoides posterior", "deltoide anterior",
    "deltoides anterior", "deltoide lateral", "deltoides lateral",
    "voador invertido", "crucifixo invertido",
  ]],
  ["Peito", ["supino", "crucifixo", "voador", "peck deck", "crossover", "cross over", "flexão", "push up", "pushup", "peitoral"], ["punho", "pulso"]],
  ["Costas", ["remada", "puxada", "barra fixa", "pulldown", "pullover", "levantamento terra", "terra romeno", "stiff", "hiperextensão", "extensão lombar", "good morning", "bom dia"]],
  ["Glúteos", [
    "glúteo", "gluteo", "hip thrust", "ponte", "abdução de quadril", "abdução do quadril",
    "adução de quadril", "adução do quadril", "coice", "elevação pélvica", "extensão de quadril",
  ]],
  ["Pernas", ["agachamento", "afundo", "leg press", "cadeira extensora", "cadeira flexora", "avanço", "passada", "hack", "extensão de perna", "flexora", "extensora", "panturrilha"]],
  ["Abdômen", [
    "abdominal", "prancha", "crunch", "oblíquo", "obliquo", "oblíqua", "obliqua",
    "dead bug", "ab wheel", "abdome", "elevação de perna", "elevação da perna",
    "torção oblíqua", "rolando como uma bola",
  ]],
  ["Cardio", ["esteira", "elíptico", "eliptico", "elíptica", "eliptica", "bike", "corrida", "air bike", "bicicleta ergométrica", "escada", "step mill", "remo ergômetro", "row erg"]],
];

function classificar(nomeArquivo) {
  const norm = normalizar(nomeArquivo);
  for (const [categoria, termos, exclusoes] of REGRAS) {
    if (exclusoes && exclusoes.some((ex) => norm.includes(normalizar(ex)))) continue;
    for (const termo of termos) {
      if (norm.includes(normalizar(termo))) return categoria;
    }
  }
  return "Não classificado";
}

function main() {
  const arquivos = fs
    .readdirSync(GIFS_DIR)
    .filter((f) => f.toLowerCase().endsWith(".gif"));

  const relatorio = arquivos.map((arquivo) => ({
    arquivo,
    categoria: classificar(arquivo),
  }));

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(relatorio, null, 2), "utf-8");

  const contagem = {};
  for (const r of relatorio) {
    contagem[r.categoria] = (contagem[r.categoria] || 0) + 1;
  }

  console.log("Distribuição por categoria:");
  Object.entries(contagem)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, n]) => console.log(`  ${cat}: ${n}`));
  console.log(`\nTotal: ${relatorio.length}`);
  console.log(`Relatório salvo em: ${OUTPUT_PATH}`);
}

main();
