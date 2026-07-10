"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/utils/supabase-browser";
import {
  gerarTreinoComIA,
  salvarTreinoGerado,
  type ConfigTreino,
  type ExercicioGerado,
  type RotinaGerada,
  type TreinoGerado,
} from "@/app/actions/gemini-treino";
import { consultarUsoIA, type UsoIA } from "@/lib/verificarLimiteIA";
import {
  listarGifs,
  atribuirGifCatalogo,
  atribuirGifCustom,
  type ExercicioGifItem,
} from "@/app/actions/exercicio-gifs";
import { GRUPOS_MUSCULARES_GIF } from "@/lib/gruposMuscularesGif";

// ─── Preview component ────────────────────────────────────────────────────────

function ExercicioCard({
  ex,
  index,
  onUpdate,
  onRemove,
  onEscolherGif,
}: {
  ex: ExercicioGerado;
  index: number;
  onUpdate: (patch: Partial<ExercicioGerado>) => void;
  onRemove: () => void;
  onEscolherGif: () => void;
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
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
            ex.fonte === "biblioteca"
              ? "border-white/15 text-white/50"
              : "border-white/10 text-white/30"
          }`}>
            {ex.fonte === "biblioteca" ? "biblioteca" : "catálogo"}
          </span>
          <button
            type="button"
            onClick={onEscolherGif}
            className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
            title="Escolher/trocar GIF de demonstração"
          >
            {ex.gif_id ? "trocar gif" : "+ gif"}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="text-white/20 hover:text-red-300 transition-colors text-sm"
            title="Remover exercício"
          >
            ×
          </button>
        </div>
      </div>

      {ex.gif_id && (
        <div className="max-w-[160px] overflow-hidden rounded-lg border border-white/10 bg-black/40">
          <img
            src={`/api/exercicio-gif/${ex.gif_id}`}
            alt={`Demonstração — ${ex.nome}`}
            className="w-full"
          />
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] text-white/35 uppercase tracking-wide">Séries</label>
          <input
            type="number" min={1} max={10} value={ex.series}
            onChange={(e) => onUpdate({ series: Number(e.target.value) })}
            className="w-full mt-1 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-white outline-none focus:border-white/25 transition-colors"
          />
        </div>
        <div>
          <label className="text-[10px] text-white/35 uppercase tracking-wide">Reps</label>
          <input
            value={ex.repeticoes}
            onChange={(e) => onUpdate({ repeticoes: e.target.value })}
            className="w-full mt-1 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-white outline-none focus:border-white/25 transition-colors"
            placeholder="8-12"
          />
        </div>
        <div>
          <label className="text-[10px] text-white/35 uppercase tracking-wide">Descanso (s)</label>
          <input
            type="number" min={0} step={15} value={ex.descanso_segundos}
            onChange={(e) => onUpdate({ descanso_segundos: Number(e.target.value) })}
            className="w-full mt-1 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-white outline-none focus:border-white/25 transition-colors"
          />
        </div>
      </div>

      <input
        value={ex.observacao ?? ""}
        onChange={(e) => onUpdate({ observacao: e.target.value })}
        className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-white/70 outline-none focus:border-white/25 transition-colors"
        placeholder="Observação (opcional)"
      />
    </div>
  );
}

function TreinoIAPreview({
  treino,
  onChange,
  onEscolherGif,
}: {
  treino: TreinoGerado;
  onChange: (t: TreinoGerado) => void;
  onEscolherGif: (ri: number, ei: number, ex: ExercicioGerado) => void;
}) {
  function updateRotina(ri: number, patch: Partial<RotinaGerada>) {
    const rotinas = treino.rotinas.map((r, i) => (i === ri ? { ...r, ...patch } : r));
    onChange({ ...treino, rotinas });
  }

  function updateExercicio(ri: number, ei: number, patch: Partial<ExercicioGerado>) {
    const rotinas = treino.rotinas.map((r, i) => {
      if (i !== ri) return r;
      return {
        ...r,
        exercicios: r.exercicios.map((ex, j) => (j === ei ? { ...ex, ...patch } : ex)),
      };
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
      {/* Cabeçalho do plano */}
      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5 space-y-3">
        <input
          value={treino.nome}
          onChange={(e) => onChange({ ...treino, nome: e.target.value })}
          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-base font-semibold text-white outline-none focus:border-white/25 transition-colors"
          placeholder="Nome do plano"
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
          <span>{totalExercicios} exercício{totalExercicios !== 1 ? "s" : ""} no total</span>
          {treino.divisao && (
            <>
              <span>·</span>
              <span>{treino.divisao}</span>
            </>
          )}
        </div>
      </div>

      {/* Uma seção por rotina */}
      {treino.rotinas.map((rotina, ri) => (
        <div key={ri} className="rounded-2xl border border-white/8 bg-white/[0.03] overflow-hidden">
          {/* Header da rotina */}
          <div className="px-5 pt-5 pb-4 border-b border-white/8 space-y-2">
            <div className="flex items-center gap-3">
              <span className="shrink-0 rounded-lg border border-white/12 bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-white/70">
                {String.fromCharCode(65 + ri)}
              </span>
              <input
                value={rotina.nome}
                onChange={(e) => updateRotina(ri, { nome: e.target.value })}
                className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-sm font-semibold text-white outline-none focus:border-white/25 transition-colors"
                placeholder="Nome da rotina"
              />
            </div>
            {rotina.foco && (
              <p className="text-xs text-white/35 pl-10">Foco: {rotina.foco}</p>
            )}
            <p className="text-xs text-white/30 pl-10">
              {rotina.exercicios.length} exercício{rotina.exercicios.length !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Exercícios desta rotina */}
          <div className="p-4 space-y-2">
            {rotina.exercicios.length === 0 ? (
              <p className="text-xs text-white/30 text-center py-3">Nenhum exercício (todos foram removidos)</p>
            ) : (
              rotina.exercicios.map((ex, ei) => (
                <ExercicioCard
                  key={ei}
                  ex={ex}
                  index={ei}
                  onUpdate={(patch) => updateExercicio(ri, ei, patch)}
                  onRemove={() => removeExercicio(ri, ei)}
                  onEscolherGif={() => onEscolherGif(ri, ei, ex)}
                />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Divisões disponíveis ─────────────────────────────────────────────────────

const DIVISOES = [
  { value: "IA decide o melhor split", label: "IA decide o melhor split" },
  { value: "Full Body", label: "Full Body (todos os dias trabalham o corpo todo)" },
  { value: "Superior / Inferior (A/B)", label: "Superior / Inferior — A/B" },
  { value: "Push / Pull / Legs (A/B/C)", label: "Push / Pull / Legs — A/B/C" },
  { value: "A/B/C/D — 4 grupos musculares", label: "A/B/C/D — 4 grupos musculares" },
  { value: "A/B/C/D/E — 5 grupos musculares", label: "A/B/C/D/E — 5 grupos musculares" },
  { value: "Condicionamento / Funcional", label: "Condicionamento / Funcional" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GerarTreinoPage() {
  const params = useParams();
  const router = useRouter();
  const alunoId = (params as any)?.alunoId as string;

  const [config, setConfig] = useState<ConfigTreino>({
    dias_por_semana: 3,
    tipo_divisao: "IA decide o melhor split",
    duracao_minutos: 60,
    nivel: "intermediario",
    equipamentos: "Academia completa",
    observacoes: "",
  });

  const [gerando, setGerando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [treino, setTreino] = useState<TreinoGerado | null>(null);
  const [uso, setUso] = useState<UsoIA | null>(null);
  const [profId, setProfId] = useState<string | null>(null);

  // ── Seletor de GIF ────────────────────────────────────────────────────────
  const [gifPickerTarget, setGifPickerTarget] = useState<{
    ri: number;
    ei: number;
    fonte: "biblioteca" | "catalogo";
    exercicioId: string;
    nome: string;
  } | null>(null);
  const [gifResultados, setGifResultados] = useState<ExercicioGifItem[]>([]);
  const [gifBusca, setGifBusca] = useState("");
  const [gifFiltroGrupo, setGifFiltroGrupo] = useState("");
  const [gifLoading, setGifLoading] = useState(false);
  const [gifSalvando, setGifSalvando] = useState(false);

  async function buscarGifsNoPicker(busca: string, grupo: string) {
    setGifLoading(true);
    const result = await listarGifs(busca, grupo);
    setGifLoading(false);
    if (result.ok) setGifResultados(result.gifs);
  }

  function abrirSeletorGif(ri: number, ei: number, ex: ExercicioGerado) {
    setGifPickerTarget({ ri, ei, fonte: ex.fonte, exercicioId: ex.exercicio_id, nome: ex.nome });
    setGifBusca("");
    setGifFiltroGrupo("");
    setGifResultados([]);
    buscarGifsNoPicker("", "");
  }

  async function selecionarGif(gifId: string | null) {
    if (!gifPickerTarget || !profId) return;
    setGifSalvando(true);

    const result =
      gifPickerTarget.fonte === "catalogo"
        ? await atribuirGifCatalogo(gifPickerTarget.exercicioId, gifId)
        : await atribuirGifCustom(gifPickerTarget.exercicioId, gifId, profId);

    setGifSalvando(false);

    if (!result.ok) return;

    const { ri, ei } = gifPickerTarget;
    setTreino((prev) => {
      if (!prev) return prev;
      const rotinas = prev.rotinas.map((r, i) => {
        if (i !== ri) return r;
        return {
          ...r,
          exercicios: r.exercicios.map((e, j) => (j === ei ? { ...e, gif_id: gifId } : e)),
        };
      });
      return { ...prev, rotinas };
    });

    setGifPickerTarget(null);
  }

  useEffect(() => {
    if (!gifPickerTarget) return;
    const t = setTimeout(() => buscarGifsNoPicker(gifBusca, gifFiltroGrupo), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gifBusca, gifFiltroGrupo, gifPickerTarget]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const id = data?.user?.id;
      if (id) {
        setProfId(id);
        consultarUsoIA(id).then(setUso);
      }
    });
  }, []);

  // Busca gif_id já vinculado a cada exercício sugerido pela IA, pra já
  // mostrar a demonstração no preview sem precisar escolher manualmente.
  async function enriquecerComGifIds(t: TreinoGerado): Promise<TreinoGerado> {
    const catIds = new Set<string>();
    const bibIds = new Set<string>();
    for (const r of t.rotinas) {
      for (const ex of r.exercicios) {
        if (ex.fonte === "catalogo") catIds.add(ex.exercicio_id);
        else bibIds.add(ex.exercicio_id);
      }
    }

    const [catRes, bibRes] = await Promise.all([
      catIds.size > 0
        ? supabase.from("exercicios_catalogo").select("id, gif_id").in("id", Array.from(catIds))
        : Promise.resolve({ data: [] as { id: string; gif_id: string | null }[] }),
      bibIds.size > 0
        ? supabase.from("exercicios").select("id, gif_id").in("id", Array.from(bibIds))
        : Promise.resolve({ data: [] as { id: string; gif_id: string | null }[] }),
    ]);

    const gifPorId = new Map<string, string | null>();
    (catRes.data || []).forEach((e: any) => gifPorId.set(e.id, e.gif_id));
    (bibRes.data || []).forEach((e: any) => gifPorId.set(e.id, e.gif_id));

    return {
      ...t,
      rotinas: t.rotinas.map((r) => ({
        ...r,
        exercicios: r.exercicios.map((ex) => ({
          ...ex,
          gif_id: gifPorId.get(ex.exercicio_id) ?? null,
        })),
      })),
    };
  }

  const limiteAtingido = uso !== null && uso.geracoes_usadas >= uso.limite_geracoes;

  const totalExercicios = treino
    ? treino.rotinas.reduce((sum, r) => sum + r.exercicios.length, 0)
    : 0;

  async function handleGerar() {
    setGerando(true);
    setErro(null);
    setTreino(null);

    try {
      const { data: auth } = await supabase.auth.getUser();
      const authProfId = auth?.user?.id;
      if (!authProfId) { setErro("Sessão expirada. Faça login novamente."); return; }

      const result = await gerarTreinoComIA(alunoId, authProfId, config);
      if (!result.ok) { setErro(result.error); return; }

      const treinoComGifs = await enriquecerComGifIds(result.treino);
      setTreino(treinoComGifs);
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
      const authProfId = auth?.user?.id;
      if (!authProfId) { setErro("Sessão expirada. Faça login novamente."); return; }

      const result = await salvarTreinoGerado(alunoId, authProfId, treino);
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
          <Link href={`/professor/alunos/${alunoId}/detalhes`} className="hover:text-white/70 transition-colors">
            Aluno
          </Link>
          <span>/</span>
          <span className="text-white/60">Gerar treino com IA</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gerar treino com IA</h1>
          <p className="mt-1 text-sm text-white/50">
            A IA lê a anamnese, histórico e fotos do aluno e monta um plano completo com rotinas separadas por dia.
          </p>
        </div>

        {/* Formulário de configuração */}
        {!treino && (
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider">
                Configurações do plano
              </h2>
              {uso && (
                <span className={`text-xs px-2.5 py-1 rounded-full border ${
                  limiteAtingido
                    ? "border-red-400/30 bg-red-400/10 text-red-300"
                    : uso.geracoes_usadas >= uso.limite_geracoes * 0.8
                    ? "border-yellow-400/30 bg-yellow-400/10 text-yellow-300"
                    : "border-white/10 text-white/40"
                }`}>
                  Gerações: {uso.geracoes_usadas}/{uso.limite_geracoes} · Revisões: {uso.revisoes_usadas}/{uso.limite_revisoes} este mês
                </span>
              )}
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
                <label className="text-xs text-white/50 uppercase tracking-wide">Equipamentos disponíveis</label>
                <input
                  value={config.equipamentos}
                  onChange={(e) => setConfig({ ...config, equipamentos: e.target.value })}
                  placeholder="Ex: academia completa, halteres, barra..."
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
                placeholder="Ex: priorizar glúteos, evitar agachamento por dor no joelho..."
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-white/25 transition-colors resize-none"
              />
            </div>

            {erro && (
              <p className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
                {erro}
              </p>
            )}

            {limiteAtingido ? (
              <div className="rounded-xl border border-red-400/20 bg-red-400/8 px-4 py-4 space-y-1.5">
                <p className="text-sm font-medium text-red-300">
                  Limite de {uso!.limite_geracoes} gerações de IA atingido este mês.
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
                  {gerando ? "Gerando plano de treino com IA…" : "Gerar plano de treino com IA"}
                </button>

                {gerando && (
                  <p className="text-center text-xs text-white/35">
                    A IA está analisando os dados e montando as rotinas. Pode levar alguns segundos…
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Preview do treino gerado */}
        {treino && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider">
                Plano gerado — revise e edite antes de salvar
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

            <TreinoIAPreview treino={treino} onChange={setTreino} onEscolherGif={abrirSeletorGif} />

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
                  : `Salvar plano (${treino.rotinas.length} rotina${treino.rotinas.length !== 1 ? "s" : ""} · ${totalExercicios} exercício${totalExercicios !== 1 ? "s" : ""})`}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Seletor de GIF */}
      {gifPickerTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setGifPickerTarget(null)} />
          <div className="relative w-full max-w-xl max-h-[85vh] flex flex-col rounded-2xl border border-white/10 bg-[#111] shadow-2xl overflow-hidden">
            <div className="px-6 pt-5 pb-3 border-b border-white/8 shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-white/50">Escolher vídeo de demonstração</p>
                  <p className="mt-0.5 text-sm font-semibold text-white">{gifPickerTarget.nome}</p>
                </div>
                <button
                  onClick={() => setGifPickerTarget(null)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-white/60 hover:bg-white/10 transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <input
                  value={gifBusca}
                  onChange={(e) => setGifBusca(e.target.value)}
                  placeholder="Buscar por nome…"
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none focus:border-white/25"
                />
                <select
                  value={gifFiltroGrupo}
                  onChange={(e) => setGifFiltroGrupo(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/25 appearance-none"
                >
                  <option value="">Todos os grupos musculares</option>
                  {GRUPOS_MUSCULARES_GIF.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              {(() => {
                const ex = treino?.rotinas[gifPickerTarget.ri]?.exercicios[gifPickerTarget.ei];
                return ex?.gif_id ? (
                  <button
                    type="button"
                    onClick={() => selecionarGif(null)}
                    disabled={gifSalvando}
                    className="mt-3 text-xs font-semibold text-red-300 hover:text-red-200 disabled:opacity-60"
                  >
                    Remover vídeo atual
                  </button>
                ) : null;
              })()}
            </div>

            <div className="overflow-y-auto flex-1 p-4">
              {gifLoading ? (
                <p className="py-8 text-center text-sm text-white/50">Buscando…</p>
              ) : gifResultados.length === 0 ? (
                <p className="py-8 text-center text-sm text-white/50">Nenhum vídeo encontrado.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3">
                  {gifResultados.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => selecionarGif(g.id)}
                      disabled={gifSalvando}
                      className="rounded-xl border border-white/10 bg-black/30 p-2 text-left hover:border-white/25 disabled:opacity-60"
                    >
                      <img
                        src={`/api/exercicio-gif/${g.id}`}
                        alt={g.nome_arquivo}
                        className="w-full rounded-lg"
                        loading="lazy"
                      />
                      <p className="mt-1.5 text-[11px] font-medium text-white/80 truncate">
                        {g.nome_arquivo.replace(/\.gif$/i, "")}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
