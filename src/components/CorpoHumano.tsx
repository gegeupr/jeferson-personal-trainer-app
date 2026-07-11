"use client";

import { useState } from "react";
import type { CategoriaAmpla } from "@/lib/categoriaAmpla";

// Diagrama simplificado de corpo humano (frente/costas) com regiões
// clicáveis por grupo muscular amplo. Não é anatomicamente preciso — é um
// mapa de navegação: clicar numa região filtra a biblioteca por aquele
// grupo, como um "MuscleWiki" simplificado.

type Regiao = {
  categoria: CategoriaAmpla;
  label: string;
  // forma: círculo ou retângulo arredondado
  shape:
    | { type: "circle"; cx: number; cy: number; r: number }
    | { type: "rect"; x: number; y: number; w: number; h: number; rx: number };
};

const REGIOES_FRENTE: Regiao[] = [
  { categoria: "Ombro", label: "Ombro", shape: { type: "circle", cx: 62, cy: 100, r: 17 } },
  { categoria: "Ombro", label: "Ombro", shape: { type: "circle", cx: 178, cy: 100, r: 17 } },
  { categoria: "Peito", label: "Peito", shape: { type: "rect", x: 78, y: 88, w: 84, h: 52, rx: 16 } },
  { categoria: "Bíceps", label: "Bíceps", shape: { type: "rect", x: 38, y: 112, w: 26, h: 68, rx: 13 } },
  { categoria: "Bíceps", label: "Bíceps", shape: { type: "rect", x: 176, y: 112, w: 26, h: 68, rx: 13 } },
  { categoria: "Abdômen", label: "Abdômen", shape: { type: "rect", x: 86, y: 144, w: 68, h: 56, rx: 14 } },
  { categoria: "Pernas", label: "Pernas (quadríceps)", shape: { type: "rect", x: 84, y: 214, w: 34, h: 112, rx: 16 } },
  { categoria: "Pernas", label: "Pernas (quadríceps)", shape: { type: "rect", x: 122, y: 214, w: 34, h: 112, rx: 16 } },
];

const REGIOES_COSTAS: Regiao[] = [
  { categoria: "Ombro", label: "Ombro (posterior)", shape: { type: "circle", cx: 62, cy: 100, r: 17 } },
  { categoria: "Ombro", label: "Ombro (posterior)", shape: { type: "circle", cx: 178, cy: 100, r: 17 } },
  { categoria: "Costas", label: "Costas", shape: { type: "rect", x: 76, y: 88, w: 88, h: 72, rx: 18 } },
  { categoria: "Tríceps", label: "Tríceps", shape: { type: "rect", x: 38, y: 112, w: 26, h: 68, rx: 13 } },
  { categoria: "Tríceps", label: "Tríceps", shape: { type: "rect", x: 176, y: 112, w: 26, h: 68, rx: 13 } },
  { categoria: "Glúteos", label: "Glúteos", shape: { type: "rect", x: 84, y: 196, w: 72, h: 46, rx: 20 } },
  { categoria: "Pernas", label: "Pernas (posterior de coxa)", shape: { type: "rect", x: 84, y: 246, w: 34, h: 68, rx: 16 } },
  { categoria: "Pernas", label: "Pernas (posterior de coxa)", shape: { type: "rect", x: 122, y: 246, w: 34, h: 68, rx: 16 } },
  { categoria: "Panturrilha", label: "Panturrilha", shape: { type: "rect", x: 84, y: 318, w: 34, h: 56, rx: 14 } },
  { categoria: "Panturrilha", label: "Panturrilha", shape: { type: "rect", x: 122, y: 318, w: 34, h: 56, rx: 14 } },
];

function Silhueta() {
  return (
    <g fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.12)" strokeWidth={1.5}>
      {/* cabeça */}
      <circle cx={120} cy={44} r={26} />
      {/* pescoço */}
      <rect x={109} y={66} width={22} height={16} rx={4} />
      {/* tronco base (contorno atrás das regiões clicáveis) */}
      <rect x={74} y={86} width={92} height={122} rx={20} />
      {/* braços — segmento inferior (antebraço), não clicável */}
      <rect x={36} y={178} width={24} height={62} rx={12} />
      <rect x={180} y={178} width={24} height={62} rx={12} />
      {/* pernas — segmento inferior (pé), não clicável */}
      <rect x={82} y={374} width={38} height={20} rx={8} />
      <rect x={120} y={374} width={38} height={20} rx={8} />
    </g>
  );
}

export function CorpoHumano({
  categoriaSelecionada,
  onSelecionar,
}: {
  categoriaSelecionada: CategoriaAmpla | null;
  onSelecionar: (categoria: CategoriaAmpla) => void;
}) {
  const [view, setView] = useState<"frente" | "costas">("frente");
  const [hover, setHover] = useState<string | null>(null);
  const regioes = view === "frente" ? REGIOES_FRENTE : REGIOES_COSTAS;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 p-1">
        <button
          type="button"
          onClick={() => setView("frente")}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
            view === "frente" ? "bg-white text-black" : "text-white/50 hover:text-white/80"
          }`}
        >
          Frente
        </button>
        <button
          type="button"
          onClick={() => setView("costas")}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
            view === "costas" ? "bg-white text-black" : "text-white/50 hover:text-white/80"
          }`}
        >
          Costas
        </button>
      </div>

      <svg viewBox="0 0 240 410" className="w-40 sm:w-48" role="img" aria-label={`Diagrama do corpo humano — vista de ${view}`}>
        <Silhueta />
        {regioes.map((r, i) => {
          const ativo = categoriaSelecionada === r.categoria;
          const key = `${view}-${i}`;
          const isHover = hover === key;
          const fill = ativo ? "rgba(255,255,255,0.35)" : isHover ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.10)";
          const stroke = ativo ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.25)";
          const commonProps = {
            fill,
            stroke,
            strokeWidth: ativo ? 2 : 1,
            className: "cursor-pointer transition-colors",
            onClick: () => onSelecionar(r.categoria),
            onMouseEnter: () => setHover(key),
            onMouseLeave: () => setHover((h) => (h === key ? null : h)),
          };
          return (
            <g key={key}>
              <title>{r.label}</title>
              {r.shape.type === "circle" ? (
                <circle cx={r.shape.cx} cy={r.shape.cy} r={r.shape.r} {...commonProps} />
              ) : (
                <rect x={r.shape.x} y={r.shape.y} width={r.shape.w} height={r.shape.h} rx={r.shape.rx} {...commonProps} />
              )}
            </g>
          );
        })}
      </svg>

      <p className="text-[11px] text-white/35 text-center max-w-[12rem]">
        Toque numa parte do corpo pra filtrar. Vire pra “Costas” pra ver costas, glúteos, tríceps e panturrilha.
      </p>
    </div>
  );
}
