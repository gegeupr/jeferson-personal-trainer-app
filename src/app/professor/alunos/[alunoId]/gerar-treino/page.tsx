"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/utils/supabase-browser";
import {
  gerarTreinoComIA,
  salvarTreinoGerado,
  type ConfigTreino,
  type ExercicioGerado,
  type TreinoGerado,
} from "@/app/actions/gemini-treino";

// ─── Preview component ────────────────────────────────────────────────────────

function TreinoIAPreview({
  treino,
  onChange,
}: {
  treino: TreinoGerado;
  onChange: (t: TreinoGerado) => void;
}) {
  function updateExercicio(i: number, patch: Partial<ExercicioGerado>) {
    const exercicios = treino.exercicios.map((ex, idx) =>
      idx === i ? { ...ex, ...patch } : ex
    );
    onChange({ ...treino, exercicios });
  }

  function removeExercicio(i: number) {
    onChange({
      ...treino,
      exercicios: treino.exercicios.filter((_, idx) => idx !== i),
    });
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho do treino */}
      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5 space-y-3">
        <input
          value={treino.nome}
          onChange={(e) => onChange({ ...treino, nome: e.target.value })}
          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-base font-semibold text-white outline-none focus:border-white/25 transition-colors"
          placeholder="Nome do treino"
        />
        <textarea
          value={treino.descricao}
          onChange={(e) => onChange({ ...treino, descricao: e.target.value })}
          rows={2}
          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white/80 outline-none focus:border-white/25 transition-colors resize-none"
          placeholder="Descrição"
        />
        <div className="flex gap-4 text-xs text-white/40">
          <span>{treino.duracao_minutos} min</span>
          <span>·</span>
          <span className="capitalize">{treino.nivel}</span>
          <span>·</span>
          <span>{treino.exercicios.length} exercício{treino.exercicios.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Lista de exercícios */}
      <div className="space-y-2">
        {treino.exercicios.map((ex, i) => (
          <div
            key={i}
            className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs text-white/30 font-mono w-5 shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <input
                  value={ex.nome}
                  onChange={(e) => updateExercicio(i, { nome: e.target.value })}
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm font-medium text-white outline-none focus:border-white/25 transition-colors"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                  ex.fonte === "biblioteca"
                    ? "border-white/15 text-white/50"
                    : "border-white/10 text-white/30"
                }`}>
                  {ex.fonte === "biblioteca" ? "biblioteca" : "catálogo"}
                </span>
                <button
                  type="button"
                  onClick={() => removeExercicio(i)}
                  className="text-white/20 hover:text-red-300 transition-colors text-sm"
                  title="Remover exercício"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-white/35 uppercase tracking-wide">Séries</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={ex.series}
                  onChange={(e) => updateExercicio(i, { series: Number(e.target.value) })}
                  className="w-full mt-1 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-white outline-none focus:border-white/25 transition-colors"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/35 uppercase tracking-wide">Reps</label>
                <input
                  value={ex.repeticoes}
                  onChange={(e) => updateExercicio(i, { repeticoes: e.target.value })}
                  className="w-full mt-1 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-white outline-none focus:border-white/25 transition-colors"
                  placeholder="8-12"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/35 uppercase tracking-wide">Descanso (s)</label>
                <input
                  type="number"
                  min={0}
                  step={15}
                  value={ex.descanso_segundos}
                  onChange={(e) => updateExercicio(i, { descanso_segundos: Number(e.target.value) })}
                  className="w-full mt-1 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-white outline-none focus:border-white/25 transition-colors"
                />
              </div>
            </div>

            <input
              value={ex.observacao ?? ""}
              onChange={(e) => updateExercicio(i, { observacao: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-white/70 outline-none focus:border-white/25 transition-colors"
              placeholder="Observação (opcional)"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const FOCOS = [
  "Full Body",
  "Superior",
  "Inferior",
  "Peito e Tríceps",
  "Costas e Bíceps",
  "Ombros",
  "Pernas",
  "Glúteos",
  "Core / Abdômen",
  "Condicionamento",
];

export default function GerarTreinoPage() {
  const params = useParams();
  const router = useRouter();
  const alunoId = (params as any)?.alunoId as string;

  const [config, setConfig] = useState<ConfigTreino>({
    dias_por_semana: 3,
    foco_muscular: "Full Body",
    duracao_minutos: 60,
    nivel: "intermediario",
    equipamentos: "Academia completa",
  });

  const [gerando, setGerando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [treino, setTreino] = useState<TreinoGerado | null>(null);

  async function handleGerar() {
    setGerando(true);
    setErro(null);
    setTreino(null);

    try {
      const { data: auth } = await supabase.auth.getUser();
      const profId = auth?.user?.id;
      if (!profId) { setErro("Sessão expirada. Faça login novamente."); return; }

      const result = await gerarTreinoComIA(alunoId, profId, config);
      if (!result.ok) { setErro(result.error); return; }
      setTreino(result.treino);
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
      if (!profId) { setErro("Sessão expirada. Faça login novamente."); return; }

      const result = await salvarTreinoGerado(alunoId, profId, treino);
      if (!result.ok) { setErro(result.error); return; }

      router.push(`/professor/alunos/${alunoId}/atribuir-treino`);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-white/40">
          <Link href="/professor/alunos" className="hover:text-white/70 transition-colors">
            Alunos
          </Link>
          <span>/</span>
          <Link href={`/professor/alunos/${alunoId}`} className="hover:text-white/70 transition-colors">
            Aluno
          </Link>
          <span>/</span>
          <span className="text-white/60">Gerar treino com IA</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gerar treino com IA</h1>
          <p className="mt-1 text-sm text-white/50">
            O Gemini lê a anamnese, histórico e fotos do aluno e monta um treino usando sua biblioteca e o catálogo.
          </p>
        </div>

        {/* Formulário de configuração */}
        {!treino && (
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6 space-y-5">
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider">
              Configurações do treino
            </h2>

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
                <label className="text-xs text-white/50 uppercase tracking-wide">Foco muscular</label>
                <select
                  value={config.foco_muscular}
                  onChange={(e) => setConfig({ ...config, foco_muscular: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-white/25 transition-colors"
                >
                  {FOCOS.map((f) => (
                    <option key={f} value={f} className="bg-[#111]">{f}</option>
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
                  {[30, 45, 60, 75, 90].map((m) => (
                    <option key={m} value={m} className="bg-[#111]">{m} minutos</option>
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
            </div>

            <div>
              <label className="text-xs text-white/50 uppercase tracking-wide">Equipamentos disponíveis</label>
              <input
                value={config.equipamentos}
                onChange={(e) => setConfig({ ...config, equipamentos: e.target.value })}
                placeholder="Ex: academia completa, halteres, barra, banco..."
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-white/25 transition-colors"
              />
            </div>

            {erro && (
              <p className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
                {erro}
              </p>
            )}

            <button
              type="button"
              onClick={handleGerar}
              disabled={gerando}
              className="w-full rounded-full bg-white px-6 py-3 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-60 transition-colors"
            >
              {gerando ? "Gerando treino com IA…" : "Gerar treino com IA"}
            </button>

            {gerando && (
              <p className="text-center text-xs text-white/35">
                O Gemini está analisando os dados do aluno. Pode levar alguns segundos…
              </p>
            )}
          </div>
        )}

        {/* Preview do treino gerado */}
        {treino && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider">
                Treino gerado — revise e edite antes de salvar
              </h2>
              <button
                type="button"
                onClick={() => { setTreino(null); setErro(null); }}
                className="text-xs text-white/40 hover:text-white/70 transition-colors"
              >
                ← Voltar ao formulário
              </button>
            </div>

            {erro && (
              <p className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
                {erro}
              </p>
            )}

            <TreinoIAPreview treino={treino} onChange={setTreino} />

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
                disabled={salvando || gerando || treino.exercicios.length === 0}
                className="flex-1 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-60 transition-colors"
              >
                {salvando ? "Salvando…" : `Salvar treino (${treino.exercicios.length} exercício${treino.exercicios.length !== 1 ? "s" : ""})`}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
