// Lógica de divisão de treino por dia (split) — compartilhada entre o server
// action de geração (gemini-treino.ts) e o wizard de configuração no client,
// pra garantir que os rótulos mostrados ao professor batam exatamente com as
// seções que a IA vai receber no prompt.

export type DiaFiltro = { label: string; categorias: string[] };

export const SPLIT_MAP: Record<string, DiaFiltro[]> = {
  abcde: [
    { label: 'Peito e Tríceps',            categorias: ['Peito', 'Tríceps'] },
    { label: 'Costas e Bíceps',            categorias: ['Costas', 'Bíceps'] },
    { label: 'Bumbum e Posterior',         categorias: ['Glúteos'] },
    { label: 'Coxa e Panturrilha',         categorias: ['Pernas', 'Panturrilha'] },
    { label: 'Ombros e Braços',            categorias: ['Ombro', 'Bíceps', 'Tríceps'] },
  ],
  abcd: [
    { label: 'Peito e Tríceps',            categorias: ['Peito', 'Tríceps'] },
    { label: 'Costas e Bíceps',            categorias: ['Costas', 'Bíceps'] },
    { label: 'Coxa e Panturrilha',         categorias: ['Pernas', 'Panturrilha'] },
    { label: 'Ombros, Bumbum e Posterior', categorias: ['Ombro', 'Glúteos'] },
  ],
  ppl: [
    { label: 'Push — Peito, Ombros e Tríceps', categorias: ['Peito', 'Ombro', 'Tríceps'] },
    { label: 'Pull — Costas e Bíceps',         categorias: ['Costas', 'Bíceps'] },
    { label: 'Legs — Pernas completas',        categorias: ['Pernas', 'Glúteos', 'Panturrilha'] },
  ],
  supinf: [
    { label: 'Superior Push — Peito, Ombros e Tríceps', categorias: ['Peito', 'Ombro', 'Tríceps'] },
    { label: 'Inferior — Coxa e Panturrilha',           categorias: ['Pernas', 'Panturrilha'] },
    { label: 'Superior Pull — Costas e Bíceps',         categorias: ['Costas', 'Bíceps'] },
    { label: 'Inferior — Bumbum e Posterior',           categorias: ['Glúteos'] },
  ],
};

export function getSplitKey(dias: number, tipo: string): string | null {
  const t = tipo.toLowerCase();
  if (t.includes('full body')) return null; // full body usa amostra de todas categorias por dia
  if (t.includes('superior') || t.includes('inferior')) return 'supinf';
  if (t.includes('push') || t.includes('pull') || t.includes('legs')) return 'ppl';
  if (t.includes('a/b/c/d')) return dias === 5 ? 'abcde' : 'abcd';
  // "IA decide o melhor split" (ou qualquer texto não reconhecido) —
  // resolve pra um split concreto pelo número de dias, nunca cai no
  // caminho "sem filtro" (que despejava o catálogo inteiro no prompt).
  if (dias <= 2) return 'supinf';
  if (dias === 3) return 'ppl';
  return dias === 5 ? 'abcde' : 'abcd';
}

export const LETRAS_DIA = ['A', 'B', 'C', 'D', 'E', 'F'];

export type DiaResolvido = { letra: string; label: string; categorias: string[] };

// Resolve o rótulo de cada dia (Treino A, B, C...) pra um split concreto —
// mesma lógica usada em buildCatalogoSections no server, exposta aqui pra o
// wizard mostrar exatamente as mesmas seções que a IA vai montar.
export function getDiasResolvidos(dias: number, tipo: string): DiaResolvido[] {
  const splitKey = getSplitKey(dias, tipo);
  const resultado: DiaResolvido[] = [];

  if (!splitKey) {
    // Full Body: todo dia trabalha o corpo todo, sem rótulo de categoria fixo.
    for (let i = 0; i < dias; i++) {
      resultado.push({ letra: LETRAS_DIA[i], label: 'Full Body', categorias: [] });
    }
    return resultado;
  }

  const filtros = SPLIT_MAP[splitKey];
  for (let i = 0; i < dias; i++) {
    const filtro = filtros[i % filtros.length];
    resultado.push({ letra: LETRAS_DIA[i], label: filtro.label, categorias: filtro.categorias });
  }
  return resultado;
}
