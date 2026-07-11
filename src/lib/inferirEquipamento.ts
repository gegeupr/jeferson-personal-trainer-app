// Infere a(s) categoria(s) de equipamento de um exercício do catálogo.
//
// O campo `equipamento` do banco está NULL pra ~2100 dos ~2750 exercícios
// (o lote importado dos GIFs não trouxe esse dado estruturado) — mas o nome
// do exercício quase sempre entrega a pista ("... com Halteres", "... no
// Cabo", "Barra Fixa", etc, seguindo o mesmo padrão usado nos nomes em
// português de todo o catálogo). Por isso a inferência sempre olha nome +
// campo equipamento juntos, nome como fallback confiável.

export const EQUIPAMENTO_TAGS = ['Barra', 'Peso Livre', 'Cabo/Polia', 'Máquina', 'Peso Corporal'] as const;

export type EquipamentoTag = typeof EQUIPAMENTO_TAGS[number];

export function inferirEquipamentos(nome: string, equipamentoDb?: string | null): EquipamentoTag[] {
  const texto = `${equipamentoDb ?? ''} ${nome ?? ''}`.toLowerCase();
  const tags: EquipamentoTag[] = [];

  if (/máquina|machine|smith|hack|pendulum|leg press|cadeira (extensora|flexora|adutora|abdutora)|voador|peck deck|belt squat|calf machine/.test(texto)) {
    tags.push('Máquina');
  }
  if (/\bcabo\b|\bpolia\b|crossover|pulley|puxad/.test(texto)) {
    tags.push('Cabo/Polia');
  }
  if (/halter|dumbbell|kettlebell/.test(texto)) {
    tags.push('Peso Livre');
  }
  if (/\bbarra\b/.test(texto) && !/barra fixa/.test(texto)) {
    tags.push('Barra');
  }
  if (/peso corporal|barra fixa|flexão de braço|prancha|\bsolo\b|paralelas|elástico|\bband\b|corporal/.test(texto)) {
    tags.push('Peso Corporal');
  }

  return tags;
}
