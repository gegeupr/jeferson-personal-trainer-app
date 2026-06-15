"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase-browser";
import {
  gerarTreinoModeloComIA,
  salvarTreinoModelo,
  type ConfigTreino,
  type ExercicioGerado,
  type RotinaGerada,
  type TreinoGerado,
} from "@/app/actions/gemini-treino";
import { consultarUsoIA, type UsoIA } from "@/lib/verificarLimiteIA";

// ─── Preview ──────────────────────────────────────────────────────────────────

function ExercicioCard({
  ex,
  index,
  onUpdate,
  onRemove,
}: {
  ex: ExercicioGerado;
  index: number;
  onUpdate: (p: Partial<ExercicioGerado>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/20 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-white/25 font-mono w-5 shrink-0">
            {String(index + 1).padStart(2, "0")}
          </span>
          <input
            value={ex.nome}
            onChange={(e) => onUpdate({ nome: e.target.value })}
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm font-medium text-white outline-none focus:border-white/25 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${ex.fonte === "biblioteca" ? "border-white/15 text-white/50" : "border-white/10 text-white/30"}`}>
            {ex.fonte === "biblioteca" ? "biblioteca" : "catálogo"}
          </span>
          <button type="button" onClick={onRemove} className="text-white/20 hover:text-red-300 transition-colors text-sm">×</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] text-white/35 uppercase tracking-wide">Séries</label>
          <input type="number" min={1} max={10} value={ex.series}
            onChange={(e) => onUpdate({ series: Number(e.target.value) })}
            className="w-full mt-1 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-white outline-none focus:border-white/25 transition-colors"
          />
        </div>
        <div>
          <label className="text-[10px] text-white/35 uppercase tracking-wide">Reps</label>
          <input value={ex.repeticoes} onChange={(e) => onUpdate({ repeticoes: e.target.value })}
            className="w-full mt-1 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-white outline-none focus:border-white/25 transition-colors"
            placeholder="8-12"
          />
        </div>
        <div>
          <label className="text-[10px] text-white/35 uppercase tracking-wide">Descanso (s)</label>
          <input type="number" min={0} step={15} value={ex.descanso_segundos}
            onChange={(e) => onUpdate({ descanso_segundos: Number(e.target.value) })}
            className="w-full mt-1 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-white outline-none focus:border-white/25 transition-colors"
          />
        </div>
      </div>

      <input value={ex.observacao ?? ""}
        onChange={(e) => onUpdate({ observacao: e.target.value })}
        className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-white/70 outline-none focus:border-white/25 transition-colors"
        placeholder="Observação (opcional)"
      />
    </div>
  );
}

function ModeloPreview({ treino, onChange }: { treino: TreinoGerado; onChange: (t: TreinoGerado) => void }) {
  function updateRotina(ri: number, patch: Partial<RotinaGerada>) {
    const rotinas = treino.rotinas.map((r, i) => (i === ri ? { ...r, ...patch } : r));
    onChange({ ...treino, rotinas });
  }

  function updateExercicio(ri: number, ei: number, patch: Partial<ExercicioGerado>) {
    const rotinas = treino.rotinas.map((r, i) => {
      if (i !== ri) return r;
      return { ...r, exercicios: r.exercicios.map((ex, j) => (j === ei ? { ...ex, ...patch } : ex)) };
    });
    onChange({ ...treino, rotinas });
  }

  function removeExercicio(ri: number, ei: number) {
    const rotinas = treino.rotinas.map((r, i) => {
      if (i !== ri) return r;
      return { ...r, exercicios: r.exercicios.filter((_, j) => j !== ei) };
    });
    onChange({ ...treino, rotinas });
  }

  const totalExercicios = treino.rotinas.reduce((sum, r) => sum + r.exercicios.length, 0);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5 space-y-3">
        <input
          value={treino.nome}
          onChange={(e) => onChange({ ...treino, nome: e.target.value })}
          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-base font-semibold text-white outline-none focus:border-white/25 transition-colors"
          placeholder="Nome do modelo"
        />
        <textarea
          value={treino.descricao}
          onChange={(e) => onChange({ ...treino, descricao: e.target.value })}
          rows={2}
          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white/80 outline-none focus:border-white/25 transition-colors resize-none"
          placeholder="Descrição"
        />
        <div className="flex flex-wrap gap-3 text-xs text-white/40">
          <span>{treino.duracao_minutos} min/sessão</span>
          <span>·</span>
          <span className="capitalize">{treino.nivel}</span>
          <span>·</span>
          <span>{treino.rotinas.length} rotina{treino.rotinas.length !== 1 ? "s" : ""}</span>
          <span>·</span>
          <span>{totalExercicios} exercício{totalExercicios !== 1 ? "s" : ""}</span>
          {treino.divisao && (<><span>·</span><span>{treino.divisao}</span></>)}
        </div>
      </div>

      {treino.rotinas.map((rotina, ri) => (
        <div key={ri} className="rounded-2xl border border-white/8 bg-white/[0.03] overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b border-white/8 space-y-2">
            <div className="flex items-center gap-3">
              <span className="shrink-0 rounded-lg border border-white/12 bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-white/70">
                {String.fromCharCode(65 + ri)}
              </span>
              <input
                value={rotina.nome}
                onChange={(e) => updateRotina(ri, { nome: e.target.value })}
                className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-sm font-semibold text-white outline-none focus:border-white/25 transition-colors"
              />
            </div>
            {rotina.foco && <p className="text-xs text-white/35 pl-10">Foco: {rotina.foco}</p>}
            <p className="text-xs text-white/30 pl-10">{rotina.exercicios.length} exercício{rotina.exercicios.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="p-4 space-y-2">
            {rotina.exercicios.length === 0 ? (
              <p className="text-xs text-white/30 text-center py-3">Nenhum exercício</p>
            ) : (
              rotina.exercicios.map((ex, ei) => (
                <ExercicioCard key={ei} ex={ex} index={ei}
                  onUpdate={(p) => updateExercicio(ri, ei, p)}
                  onRemove={() => removeExercicio(ri, ei)}
                />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const DIVISOES = [
  { value: "IA decide o melhor split", label: "IA decide o melhor split" },
  { value: "Full Body", label: "Full Body (todos os dias trabalham o corpo todo)" },
  { value: "Superior / Inferior (A/B)", label: "Superior / Inferior — A/B" },
  { value: "Push / Pull / Legs (A/B/C)", label: "Push / Pull / Legs — A/B/C" },
  { value: "A/B/C/D — 4 grupos musculares", label: "A/B/C/D — 4 grupos musculares" },
  { value: "A/B/C/D/E — 5 grupos musculares", label: "A/B/C/D/E — 5 grupos musculares" },
  { value: "Condicionamento / Funcional", label: "Condicionamento / Funcional" },
];

const PRE_PROMPTS = [
  "Idoso com hipertensão, mobilidade reduzida, sem impacto articular",
  "Gestante 2º trimestre, sem exercícios supinos, baixo impacto",
  "Pós-cirúrgico joelho, reabilitação com foco em quadríceps",
  "Jovem sedentário com sobrepeso, foco em emagrecimento e condicionamento",
  "Atleta avançado, hipertrofia máxima, alta frequência semanal",
  "Iniciante sem equipamento, treino em casa com peso corporal",
  "Adulto com lombalgia crônica, sem cargas axiais pesadas",
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GerarModeloPage() {
  const router = useRouter();

  const [config, setConfig] = useState<ConfigTreino>({
    dias_por_semana: 3,
    tipo_divisao: "IA decide o melhor split",
    duracao_minutos: 60,
    nivel: "intermediario",
    equipamentos: "Academia completa",
    observacoes: "",
    perfil_modelo: "",
  });

  const [gerando, setGerando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [treino, setTreino] = useState<TreinoGerado | null>(null);
  const [uso, setUso] = useState<UsoIA | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const profId = data?.user?.id;
      if (profId) consultarUsoIA(profId).then(setUso);
    });
  }, []);

  const limiteAtingido = uso !== null && uso.geracoes_usadas >= uso.limite;

  const totalExercicios = treino
    ? treino.rotinas.reduce((sum, r) => sum + r.exercicios.length, 0)
    : 0;

  async function handleGerar() {
    setGerando(true);
    setErro(null);
    setTreino(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const profId = auth?.user?.id;
      if (!profId) { setErro("Sessão expirada."); return; }

      const result = await gerarTreinoModeloComIA(profId, config);
      if (!result.ok) { setErro(result.error); return; }
      setTreino(result.treino);
      setUso((u) => u ? { ...u, geracoes_usadas: u.geracoes_usadas + 1 } : u);
    } finally {
      setGerando(false);
    }
  }

  async function handleSalvar() {
    if (!treino) return;
    setSalvando(true);
    setErro(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const profId = auth?.user?.id;
      if (!profId) { setErro("Sessão expirada."); return; }

      const result = await salvarTreinoModelo(profId, treino, config.perfil_modelo);
      if (!result.ok) { setErro(result.error); return; }

      router.push("/professor/treinos/modelos");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-white/40">
          <Link href="/professor/treinos" className="hover:text-white/70 transition-colors">Treinos</Link>
          <span>/</span>
          <Link href="/professor/treinos/modelos" className="hover:text-white/70 transition-colors">Modelos IA</Link>
          <span>/</span>
          <span className="text-white/60">Gerar modelo</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gerar treino-modelo com IA</h1>
          <p className="mt-1 text-sm text-white/50">
            Crie um plano reutilizável baseado em um perfil de aluno-tipo. Salve na biblioteca e aplique a qualquer aluno depois.
          </p>
        </div>

        {!treino && (
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Configurações</h2>
              {uso && (
                <span className={`text-xs px-2.5 py-1 rounded-full border ${
                  limiteAtingido
                    ? "border-red-400/30 bg-red-400/10 text-red-300"
                    : uso.geracoes_usadas >= uso.limite * 0.8
                    ? "border-yellow-400/30 bg-yellow-400/10 text-yellow-300"
                    : "border-white/10 text-white/40"
                }`}>
                  {uso.geracoes_usadas}/{uso.limite} gerações este mês
                </span>
              )}
            </div>

            {/* Perfil do aluno-tipo */}
            <div>
              <label className="text-xs text-white/50 uppercase tracking-wide">Perfil do aluno-tipo</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {PRE_PROMPTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setConfig((c) => ({ ...c, perfil_modelo: p }))}
                    className={`rounded-full px-3 py-1 text-xs border transition-colors ${
                      config.perfil_modelo === p
                        ? "bg-white text-black border-white"
                        : "border-white/15 text-white/50 hover:border-white/30 hover:text-white/70"
                    }`}
                  >
                    {p.split(",")[0]}
                  </button>
                ))}
              </div>
              <textarea
                value={config.perfil_modelo ?? ""}
                onChange={(e) => setConfig({ ...config, perfil_modelo: e.target.value })}
                rows={3}
                placeholder="Descreva o perfil do aluno-tipo para este modelo: objetivos, limitações, nível, condições de saúde…"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-white/25 transition-colors resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-white/50 uppercase tracking-wide">Dias por semana</label>
                <select
                  value={config.dias_por_semana}
                  onChange={(e) => setConfig({ ...config, dias_por_semana: Number(e.target.value) })}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-white/25 transition-colors"
                >
                  {[2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n} className="bg-[#111]">{n}x por semana</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-white/50 uppercase tracking-wide">Nível</label>
                <select
                  value={config.nivel}
                  onChange={(e) => setConfig({ ...config, nivel: e.target.value as ConfigTreino["nivel"] })}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-white/25 transition-colors"
                >
                  <option value="iniciante" className="bg-[#111]">Iniciante</option>
                  <option value="intermediario" className="bg-[#111]">Intermediário</option>
                  <option value="avancado" className="bg-[#111]">Avançado</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs text-white/50 uppercase tracking-wide">Divisão dos treinos</label>
                <select
                  value={config.tipo_divisao}
                  onChange={(e) => setConfig({ ...config, tipo_divisao: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-white/25 transition-colors"
                >
                  {DIVISOES.map((d) => (
                    <option key={d.value} value={d.value} className="bg-[#111]">{d.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-white/50 uppercase tracking-wide">Duração da sessão</label>
                <select
                  value={config.duracao_minutos}
                  onChange={(e) => setConfig({ ...config, duracao_minutos: Number(e.target.value) })}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-white/25 transition-colors"
                >
                  {[30, 45, 60, 75, 90, 120].map((m) => (
                    <option key={m} value={m} className="bg-[#111]">{m} minutos</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-white/50 uppercase tracking-wide">Equipamentos</label>
                <input
                  value={config.equipamentos}
                  onChange={(e) => setConfig({ ...config, equipamentos: e.target.value })}
                  placeholder="Ex: academia completa, halteres..."
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-white/25 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-white/50 uppercase tracking-wide">Observações adicionais (opcional)</label>
              <textarea
                value={config.observacoes ?? ""}
                onChange={(e) => setConfig({ ...config, observacoes: e.target.value })}
                rows={2}
                placeholder="Ex: incluir trabalho de mobilidade, evitar agachamento..."
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-white/25 transition-colors resize-none"
              />
            </div>

            {erro && (
              <p className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">{erro}</p>
            )}

            {limiteAtingido ? (
              <div className="rounded-xl border border-red-400/20 bg-red-400/8 px-4 py-4 space-y-1.5">
                <p className="text-sm font-medium text-red-300">
                  Limite de {uso!.limite} gerações de IA atingido este mês.
                </p>
                <p className="text-xs text-white/50">
                  O limite renova no dia 1º do próximo mês. Você ainda pode atribuir modelos existentes da biblioteca, criar treinos manualmente e editar os treinos dos alunos — apenas a geração nova com IA está pausada.
                </p>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleGerar}
                  disabled={gerando}
                  className="w-full rounded-full bg-white px-6 py-3 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-60 transition-colors"
                >
                  {gerando ? "Gerando modelo com IA…" : "Gerar modelo com IA"}
                </button>

                {gerando && (
                  <p className="text-center text-xs text-white/35">
                    A IA está montando o modelo. Pode levar alguns segundos…
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {treino && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider">
                Modelo gerado — revise o nome e os exercícios antes de salvar
              </h2>
              <button
                type="button"
                onClick={() => { setTreino(null); setErro(null); }}
                className="text-xs text-white/40 hover:text-white/70 transition-colors"
              >
                ← Voltar
              </button>
            </div>

            {erro && (
              <p className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">{erro}</p>
            )}

            <ModeloPreview treino={treino} onChange={setTreino} />

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleGerar}
                disabled={gerando || salvando}
                className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white/80 hover:border-white/30 disabled:opacity-50 transition-colors"
              >
                {gerando ? "Gerando…" : "↺ Regenerar"}
              </button>
              <button
                type="button"
                onClick={handleSalvar}
                disabled={salvando || gerando || totalExercicios === 0}
                className="flex-1 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-60 transition-colors"
              >
                {salvando
                  ? "Salvando…"
                  : `Salvar na biblioteca (${treino.rotinas.length} rotinas · ${totalExercicios} exercícios)`}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
