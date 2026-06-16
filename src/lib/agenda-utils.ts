"use client";

export type DisponibilidadeSlot = {
  id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  tipo: "presencial" | "online";
  valor: number | null;
  moeda: string;
  ativo: boolean;
};

export type SlotGerado = {
  disponibilidade_id: string;
  data_hora_inicio: string; // ISO string no timezone local do browser
  data_hora_fim: string;
  tipo: "presencial" | "online";
  valor: number | null;
  moeda: string;
};

export function gerarSlotsDisponiveis(
  disponibilidade: DisponibilidadeSlot[],
  ocupados: string[],
  semanas = 4
): SlotGerado[] {
  const agora = new Date();
  const limiteMin = new Date(agora.getTime() + 60 * 60 * 1000); // mínimo 1h de antecedência
  const limite = new Date(agora);
  limite.setDate(limite.getDate() + semanas * 7);

  const ocupadosSet = new Set(ocupados);
  const resultado: SlotGerado[] = [];

  const cursor = new Date(agora);
  cursor.setHours(0, 0, 0, 0);

  while (cursor <= limite) {
    const diaSemana = cursor.getDay();

    for (const slot of disponibilidade) {
      if (!slot.ativo || slot.dia_semana !== diaSemana) continue;

      const [hIni, mIni] = slot.hora_inicio.split(":").map(Number);
      const [hFim, mFim] = slot.hora_fim.split(":").map(Number);

      const dataInicio = new Date(cursor);
      dataInicio.setHours(hIni, mIni, 0, 0);

      const dataFim = new Date(cursor);
      dataFim.setHours(hFim, mFim, 0, 0);

      if (dataInicio <= limiteMin) continue;

      // Compara usando timestamp local normalizado
      const isoInicio = dataInicio.toISOString();
      if (ocupadosSet.has(isoInicio)) continue;

      resultado.push({
        disponibilidade_id: slot.id,
        data_hora_inicio: isoInicio,
        data_hora_fim: dataFim.toISOString(),
        tipo: slot.tipo,
        valor: slot.valor,
        moeda: slot.moeda,
      });
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return resultado;
}

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DIAS_FULL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function nomeDiaSemana(dia: number, abrev = false): string {
  return abrev ? DIAS[dia] : DIAS_FULL[dia];
}

export function formatarDataHoraBR(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatarHoraBR(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatarDataBR(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

export function formatarValor(valor: number | null, moeda = "BRL"): string {
  if (valor === null) return "Gratuito";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: moeda }).format(valor);
}
