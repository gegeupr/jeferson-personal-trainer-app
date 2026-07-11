// Normaliza QUALQUER grupo_muscular (granular antigo tipo "Peitoral maior",
// ou amplo novo tipo "Peito") pra uma das categorias fixas abaixo. Isso é
// mais confiável que depender de movement_pattern, que só está preenchido
// pros ~640 exercícios curados originalmente — os ~2100 vindos do GIF usam
// só grupo_muscular.
//
// Módulo compartilhado entre o server action de geração de treino
// (gemini-treino.ts) e a UI de biblioteca no client (mapa do corpo humano),
// pra manter uma única fonte de verdade pras categorias.

export const CATEGORIAS_AMPLAS = [
  'Peito', 'Costas', 'Ombro', 'Bíceps', 'Tríceps', 'Glúteos', 'Panturrilha',
  'Pernas', 'Abdômen', 'Cardio', 'Mobilidade', 'Funcional', 'Outro',
] as const;

export type CategoriaAmpla = typeof CATEGORIAS_AMPLAS[number];

export function categoriaAmpla(grupoMuscular: string | null | undefined): CategoriaAmpla {
  const g = (grupoMuscular ?? '').toLowerCase();
  if (g.includes('peitoral') || g === 'peito') return 'Peito';
  if (g.includes('dorsal') || g.includes('romboide') || g.includes('trapézio') || g.includes('lombar') || g.includes('eretor') || g === 'costas') return 'Costas';
  if (g.includes('deltoide') || g === 'ombro' || g === 'ombros') return 'Ombro';
  // "tríceps braquial" contém "braquial" — checar tríceps ANTES do bíceps
  // pra não cair na categoria errada.
  if (g.includes('tríceps')) return 'Tríceps';
  if (g.includes('bíceps') || g.includes('braquial')) return 'Bíceps';
  if (g.includes('glúteo')) return 'Glúteos';
  if (g.includes('gastrocnêmio') || g.includes('sóleo') || g === 'panturrilha') return 'Panturrilha';
  if (g.includes('quadríceps') || g.includes('posterior de coxa') || g.includes('adutor') || g === 'pernas') return 'Pernas';
  if (g.includes('core') || g.includes('oblíquo') || g.includes('abdominal') || g.includes('abdome') || g === 'abdômen') return 'Abdômen';
  if (g.includes('cardiorrespirat') || g === 'cardio') return 'Cardio';
  if (g === 'mobilidade' || g === 'alongamento') return 'Mobilidade';
  if (g === 'funcional') return 'Funcional';
  return 'Outro';
}
