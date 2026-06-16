"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/utils/supabase-browser';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

type ExercicioEdit = {
  te_id: string;           // temp "novo-xxx" para exercícios ainda não salvos
  rotina_id: string;
  ordem: number;
  nome: string;
  series: number;
  repeticoes: string;
  intervalo: string;
  observacoes: string;
  removido: boolean;
  novo: boolean;
  exercicio_id: string | null;
  catalogo_id: string | null;
  fonte: 'catalogo' | 'biblioteca';
  grupo_muscular: string;
};

type RotinaInfo    = { id: string; nome: string; descricao: string };
type TreinoMeta    = { id: string; nome: string; descricao: string; gerado_por_ia: boolean };
type SearchItem    = { id: string; nome: string; fonte: 'catalogo' | 'biblioteca'; grupo: string; equip: string };
type ModalState    =
  | { open: false }
  | { open: true; mode: 'replace'; teId: string; grupoRef: string }
  | { open: true; mode: 'add';     rotinaId: string };

// ─── SearchModal ──────────────────────────────────────────────────────────────

function ResultRow({ item, onClick }: { item: SearchItem; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-2.5 hover:bg-white/5 transition-colors flex items-center gap-3"
    >
      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide border ${
        item.fonte === 'biblioteca' ? 'border-white/25 text-white/50' : 'border-white/10 text-white/30'
      }`}>
        {item.fonte === 'biblioteca' ? 'BIBL' : 'CAT'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-white truncate">{item.nome}</p>
        {(item.grupo || item.equip) && (
          <p className="text-xs text-white/35 truncate">{[item.grupo, item.equip].filter(Boolean).join(' · ')}</p>
        )}
      </div>
    </button>
  );
}

function SearchModal({
  state,
  items,
  loading,
  onSelect,
  onClose,
}: {
  state: ModalState & { open: true };
  items: SearchItem[];
  loading: boolean;
  onSelect: (item: SearchItem) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const grupoRef = state.mode === 'replace' ? state.grupoRef.toLowerCase() : '';

  const filtered = items.filter(item =>
    item.nome.toLowerCase().includes(query.toLowerCase()) ||
    item.grupo.toLowerCase().includes(query.toLowerCase())
  );

  const sugeridos = !query && grupoRef ? filtered.filter(i => i.grupo.toLowerCase().includes(grupoRef)) : [];
  const resto     = sugeridos.length > 0 ? filtered.filter(i => !sugeridos.includes(i)) : filtered;

  return (
    <div className="fixed inset-0 bg-black/80 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg bg-[#111] border border-white/10 rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-white/8 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-white">
              {state.mode === 'add' ? 'Adicionar exercício' : 'Trocar exercício'}
            </p>
            <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors text-xl leading-none">×</button>
          </div>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por nome ou grupo muscular…"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-white/25 transition-colors"
          />
        </div>

        {/* Results */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <p className="px-4 py-8 text-sm text-white/30 text-center">Carregando exercícios…</p>
          ) : filtered.length === 0 ? (
            <p className="px-4 py-8 text-sm text-white/30 text-center">Nenhum exercício encontrado</p>
          ) : (
            <>
              {sugeridos.length > 0 && (
                <>
                  <p className="px-4 pt-3 pb-1 text-[10px] text-white/30 uppercase tracking-wide">
                    Mesmo grupo muscular
                  </p>
                  {sugeridos.map(i => <ResultRow key={i.fonte + i.id} item={i} onClick={() => onSelect(i)} />)}
                  {resto.length > 0 && (
                    <p className="px-4 pt-3 pb-1 text-[10px] text-white/30 uppercase tracking-wide">Outros exercícios</p>
                  )}
                </>
              )}
              {resto.map(i => <ResultRow key={i.fonte + i.id} item={i} onClick={() => onSelect(i)} />)}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VerEditarTreinoPage() {
  const router   = useRouter();
  const params   = useParams();
  const alunoId  = params.alunoId  as string;
  const treinoId = params.treinoId as string;

  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [dirty,    setDirty]    = useState(false);
  const [toasts,   setToasts]   = useState<{ id: number; msg: string; kind: 'ok' | 'err' }[]>([]);

  const [treino,    setTreino]    = useState<TreinoMeta | null>(null);
  const [rotinas,   setRotinas]   = useState<RotinaInfo[]>([]);
  const [exercicios, setExercicios] = useState<ExercicioEdit[]>([]);

  const [modalState,   setModalState]   = useState<ModalState>({ open: false });
  const [searchItems,  setSearchItems]  = useState<SearchItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchLoaded = useRef(false);

  // ── helpers ────────────────────────────────────────────────────────────────

  function pushToast(msg: string, kind: 'ok' | 'err') {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, kind }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }

  // ── fetch exercises (usado no mount e após salvar) ─────────────────────────

  const fetchExercicios = useCallback(async (rotinaIds: string[]) => {
    if (rotinaIds.length === 0) return;

    const { data: exData } = await supabase
      .from('treino_exercicios')
      .select('id, rotina_id, ordem, series, repeticoes, intervalo, observacoes, exercicio_id, catalogo_id')
      .in('rotina_id', rotinaIds)
      .order('ordem');

    const catIds = (exData || []).filter((e: any) => e.catalogo_id).map((e: any) => e.catalogo_id as string);
    const bibIds = (exData || []).filter((e: any) => e.exercicio_id).map((e: any) => e.exercicio_id as string);

    const [catRes, bibRes] = await Promise.all([
      catIds.length > 0
        ? supabase.from('exercicios_catalogo').select('id, nome, grupo_muscular').in('id', catIds)
        : Promise.resolve({ data: [] }),
      bibIds.length > 0
        ? supabase.from('exercicios').select('id, nome').in('id', bibIds)
        : Promise.resolve({ data: [] }),
    ]);

    const catMap = new Map((catRes.data || []).map((e: any) => [e.id, { nome: e.nome as string, grupo: (e.grupo_muscular || '') as string }]));
    const bibMap = new Map((bibRes.data || []).map((e: any) => [e.id, e.nome as string]));

    setExercicios((exData || []).map((e: any) => {
      const isCat  = !!e.catalogo_id;
      const catInfo = isCat ? catMap.get(e.catalogo_id) : null;
      return {
        te_id:         e.id,
        rotina_id:     e.rotina_id,
        ordem:         e.ordem,
        nome:          catInfo?.nome || bibMap.get(e.exercicio_id) || 'Exercício desconhecido',
        series:        e.series    ?? 3,
        repeticoes:    e.repeticoes ?? '10',
        intervalo:     e.intervalo  ?? '',
        observacoes:   e.observacoes ?? '',
        removido:      false,
        novo:          false,
        exercicio_id:  e.exercicio_id  || null,
        catalogo_id:   e.catalogo_id   || null,
        fonte:         isCat ? 'catalogo' : 'biblioteca',
        grupo_muscular: catInfo?.grupo || '',
      } satisfies ExercicioEdit;
    }));
  }, []);

  // ── mount ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: treinoData, error: treinoErr } = await supabase
        .from('treinos')
        .select('id, nome, descricao, gerado_por_ia, professor_id')
        .eq('id', treinoId)
        .single();

      if (treinoErr || !treinoData) { setError('Treino não encontrado.'); setLoading(false); return; }
      if ((treinoData as any).professor_id !== user.id) { setError('Acesso negado.'); setLoading(false); return; }

      setTreino({
        id:           treinoData.id,
        nome:         treinoData.nome,
        descricao:    (treinoData as any).descricao || '',
        gerado_por_ia: (treinoData as any).gerado_por_ia ?? false,
      });

      const { data: rotinasData } = await supabase
        .from('rotinas_diarias')
        .select('id, nome, descricao')
        .eq('plano_id', treinoId)
        .order('nome');

      const list: RotinaInfo[] = (rotinasData || []).map((r: any) => ({
        id: r.id, nome: r.nome, descricao: r.descricao || '',
      }));
      setRotinas(list);

      await fetchExercicios(list.map(r => r.id));
      setLoading(false);
    }
    init();
  }, [treinoId, router, fetchExercicios]);

  // ── lazy-load search items ─────────────────────────────────────────────────

  const loadSearchItems = useCallback(async () => {
    if (searchLoaded.current) return;
    searchLoaded.current = true;
    setSearchLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    const [catRes, bibRes] = await Promise.all([
      supabase.from('exercicios_catalogo').select('id, nome, grupo_muscular, equipamento').order('nome').limit(700),
      user
        ? supabase.from('exercicios').select('id, nome').eq('professor_id', user.id).order('nome')
        : Promise.resolve({ data: [] }),
    ]);

    setSearchItems([
      ...(bibRes.data || []).map((e: any) => ({
        id: e.id, nome: e.nome, fonte: 'biblioteca' as const, grupo: '', equip: '',
      })),
      ...(catRes.data || []).map((e: any) => ({
        id: e.id, nome: e.nome, fonte: 'catalogo' as const,
        grupo: e.grupo_muscular || '', equip: e.equipamento || '',
      })),
    ]);
    setSearchLoading(false);
  }, []);

  // ── modal helpers ──────────────────────────────────────────────────────────

  function openReplaceModal(teId: string) {
    const ex = exercicios.find(e => e.te_id === teId);
    setModalState({ open: true, mode: 'replace', teId, grupoRef: ex?.grupo_muscular || '' });
    loadSearchItems();
  }

  function openAddModal(rotinaId: string) {
    setModalState({ open: true, mode: 'add', rotinaId });
    loadSearchItems();
  }

  function handleSelectItem(item: SearchItem) {
    if (!modalState.open) return;

    if (modalState.mode === 'replace') {
      setExercicios(prev => prev.map(ex =>
        ex.te_id === modalState.teId
          ? { ...ex, nome: item.nome, fonte: item.fonte,
              exercicio_id: item.fonte === 'biblioteca' ? item.id : null,
              catalogo_id:  item.fonte === 'catalogo'   ? item.id : null,
              grupo_muscular: item.grupo }
          : ex
      ));
    } else {
      const rotinaExs = exercicios.filter(e => e.rotina_id === modalState.rotinaId && !e.removido);
      const nextOrdem = rotinaExs.length > 0 ? Math.max(...rotinaExs.map(e => e.ordem)) + 1 : 1;
      setExercicios(prev => [...prev, {
        te_id:         `novo-${Date.now()}`,
        rotina_id:     modalState.rotinaId,
        ordem:         nextOrdem,
        nome:          item.nome,
        series:        3,
        repeticoes:    '10-12',
        intervalo:     '60s',
        observacoes:   '',
        removido:      false,
        novo:          true,
        exercicio_id:  item.fonte === 'biblioteca' ? item.id : null,
        catalogo_id:   item.fonte === 'catalogo'   ? item.id : null,
        fonte:         item.fonte,
        grupo_muscular: item.grupo,
      }]);
    }

    setDirty(true);
    setModalState({ open: false });
  }

  // ── exercise mutations ─────────────────────────────────────────────────────

  function updateExercicio(teId: string, patch: Partial<ExercicioEdit>) {
    setExercicios(prev => prev.map(ex => ex.te_id === teId ? { ...ex, ...patch } : ex));
    setDirty(true);
  }

  function removeExercicio(teId: string) {
    setExercicios(prev => prev.map(ex => ex.te_id === teId ? { ...ex, removido: true } : ex));
    setDirty(true);
  }

  // ── save ───────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!treino) return;
    setSaving(true);
    try {
      // 1. treino meta
      const { error: tErr } = await supabase
        .from('treinos')
        .update({ nome: treino.nome, descricao: treino.descricao })
        .eq('id', treinoId);
      if (tErr) throw tErr;

      // 1b. nomes das rotinas
      for (const rotina of rotinas) {
        await supabase
          .from('rotinas_diarias')
          .update({ nome: rotina.nome })
          .eq('id', rotina.id);
      }

      // 2. update existentes (inclusive trocados)
      for (const ex of exercicios.filter(e => !e.removido && !e.novo)) {
        const { error: exErr } = await supabase
          .from('treino_exercicios')
          .update({
            exercicio_id: ex.exercicio_id,
            catalogo_id:  ex.catalogo_id,
            series:       ex.series,
            repeticoes:   ex.repeticoes,
            intervalo:    ex.intervalo   || null,
            observacoes:  ex.observacoes || null,
          })
          .eq('id', ex.te_id);
        if (exErr) throw exErr;
      }

      // 3. inserir novos
      const novos = exercicios.filter(e => !e.removido && e.novo);
      if (novos.length > 0) {
        const { error: insErr } = await supabase
          .from('treino_exercicios')
          .insert(novos.map(ex => ({
            rotina_id:   ex.rotina_id,
            exercicio_id: ex.exercicio_id,
            catalogo_id:  ex.catalogo_id,
            ordem:        ex.ordem,
            series:       ex.series,
            repeticoes:   ex.repeticoes,
            intervalo:    ex.intervalo   || null,
            observacoes:  ex.observacoes || null,
          })));
        if (insErr) throw insErr;
      }

      // 4. deletar removidos (não novos)
      for (const ex of exercicios.filter(e => e.removido && !e.novo)) {
        await supabase.from('treino_exercicios').delete().eq('id', ex.te_id);
      }

      // 5. reload do banco para obter IDs reais dos novos
      await fetchExercicios(rotinas.map(r => r.id));
      setDirty(false);
      pushToast('Alterações salvas!', 'ok');
    } catch (e: any) {
      pushToast('Erro ao salvar: ' + (e?.message ?? 'desconhecido'), 'err');
    } finally {
      setSaving(false);
    }
  }

  // ── render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-white/40 text-sm">Carregando treino…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-lg mx-auto mt-10">
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
          <p className="text-red-300 text-sm">{error}</p>
          <Link href={`/professor/alunos/${alunoId}/atribuir-treino`} className="mt-4 inline-block text-sm text-white/50 hover:text-white/70 transition-colors">
            ← Voltar
          </Link>
        </div>
      </div>
    );
  }

  const totalAtivos = exercicios.filter(e => !e.removido).length;

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white px-4 py-8 pb-36">
      <div className="max-w-3xl mx-auto space-y-5">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-white/40 flex-wrap">
          <Link href="/professor/alunos" className="hover:text-white/70 transition-colors">Alunos</Link>
          <span>/</span>
          <Link href={`/professor/alunos/${alunoId}/atribuir-treino`} className="hover:text-white/70 transition-colors">Treinos</Link>
          <span>/</span>
          <span className="text-white/60 truncate max-w-[180px]">{treino?.nome}</span>
        </div>

        {/* Cabeçalho do treino */}
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <label className="text-[10px] text-white/30 uppercase tracking-wide">Nome do plano</label>
              <input
                value={treino?.nome ?? ''}
                onChange={e => { setTreino(t => t ? { ...t, nome: e.target.value } : t); setDirty(true); }}
                className="mt-1 w-full bg-transparent border-b border-white/10 pb-1 text-base font-medium text-white outline-none focus:border-white/30 transition-colors"
              />
            </div>
            {treino?.gerado_por_ia && (
              <span className="shrink-0 rounded-full border border-white/15 bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-white/50">IA</span>
            )}
          </div>
          <div>
            <label className="text-[10px] text-white/30 uppercase tracking-wide">Descrição</label>
            <textarea
              value={treino?.descricao ?? ''}
              onChange={e => { setTreino(t => t ? { ...t, descricao: e.target.value } : t); setDirty(true); }}
              rows={2}
              className="mt-1 w-full bg-transparent border-b border-white/10 pb-1 text-sm text-white/60 outline-none focus:border-white/30 transition-colors resize-none"
            />
          </div>
          <p className="text-xs text-white/25">
            {rotinas.length} rotina{rotinas.length !== 1 ? 's' : ''} · {totalAtivos} exercício{totalAtivos !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Rotinas */}
        {rotinas.map(rotina => {
          const exsRotina = exercicios.filter(e => e.rotina_id === rotina.id && !e.removido);
          const letra     = rotina.nome.match(/Treino\s+([A-Z])/)?.[1] ?? rotina.nome[0]?.toUpperCase() ?? '?';

          return (
            <div key={rotina.id} className="rounded-2xl border border-white/8 bg-white/[0.03] overflow-hidden">

              {/* Rotina header */}
              <div className="px-5 py-3 border-b border-white/8 flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-white/8 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-white/60">{letra}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <input
                    value={rotina.nome}
                    onChange={e => {
                      setRotinas(prev => prev.map(r => r.id === rotina.id ? { ...r, nome: e.target.value } : r));
                      setDirty(true);
                    }}
                    className="w-full bg-transparent text-sm font-medium text-white outline-none border-b border-transparent hover:border-white/10 focus:border-white/30 transition-colors pb-0.5"
                  />
                  {rotina.descricao && <p className="text-xs text-white/35 truncate mt-0.5">{rotina.descricao}</p>}
                </div>
                <span className="shrink-0 text-xs text-white/25">{exsRotina.length} ex.</span>
              </div>

              {/* Exercícios */}
              <div className="divide-y divide-white/5">
                {exsRotina.length === 0 && (
                  <p className="px-5 py-4 text-xs text-white/25 text-center">Nenhum exercício nesta rotina</p>
                )}

                {exsRotina.map(ex => (
                  <div key={ex.te_id} className="px-5 py-3 space-y-2">

                    {/* Nome + ações */}
                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-sm font-medium text-white min-w-0 truncate">{ex.nome}</span>
                      {ex.novo && (
                        <span className="shrink-0 rounded-full border border-white/15 bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-white/40 uppercase tracking-wide">novo</span>
                      )}
                      {/* Trocar */}
                      <button
                        onClick={() => openReplaceModal(ex.te_id)}
                        title="Trocar exercício"
                        className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/40 hover:text-white/70 hover:bg-white/8 transition-colors"
                      >
                        ⇄
                      </button>
                      {/* Remover */}
                      <button
                        onClick={() => removeExercicio(ex.te_id)}
                        title="Remover exercício"
                        className="shrink-0 text-white/20 hover:text-red-400 transition-colors text-xl leading-none"
                      >×</button>
                    </div>

                    {/* Campos */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-white/30 uppercase tracking-wide">Séries</label>
                        <input
                          type="number" min={1} max={10}
                          value={ex.series}
                          onChange={e => updateExercicio(ex.te_id, { series: Number(e.target.value) })}
                          className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white outline-none focus:border-white/25 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-white/30 uppercase tracking-wide">Repetições</label>
                        <input
                          value={ex.repeticoes}
                          onChange={e => updateExercicio(ex.te_id, { repeticoes: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white outline-none focus:border-white/25 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-white/30 uppercase tracking-wide">Descanso</label>
                        <input
                          value={ex.intervalo}
                          onChange={e => updateExercicio(ex.te_id, { intervalo: e.target.value })}
                          placeholder="ex: 60s"
                          className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white outline-none focus:border-white/25 transition-colors"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-white/30 uppercase tracking-wide">Observação</label>
                      <input
                        value={ex.observacoes}
                        onChange={e => updateExercicio(ex.te_id, { observacoes: e.target.value })}
                        placeholder="dica de execução…"
                        className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white/60 outline-none focus:border-white/25 transition-colors"
                      />
                    </div>
                  </div>
                ))}

                {/* Adicionar exercício */}
                <div className="px-5 py-3">
                  <button
                    onClick={() => openAddModal(rotina.id)}
                    className="w-full rounded-xl border border-dashed border-white/10 py-2 text-xs text-white/30 hover:border-white/20 hover:text-white/50 transition-colors"
                  >
                    + Adicionar exercício
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer — salvar */}
      <div className={`fixed bottom-16 lg:bottom-0 left-0 right-0 px-4 py-3 bg-[#0a0a0a]/95 border-t border-white/8 backdrop-blur-sm z-40 transition-opacity duration-150 ${dirty ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <p className="text-sm text-white/40">Alterações não salvas</p>
          <div className="flex gap-2">
            <button
              onClick={() => router.push(`/professor/alunos/${alunoId}/atribuir-treino`)}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/60 hover:bg-white/8 transition-colors"
            >
              Descartar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </div>
        </div>
      </div>

      {/* Modal de busca */}
      {modalState.open && (
        <SearchModal
          state={modalState}
          items={searchItems}
          loading={searchLoading}
          onSelect={handleSelectItem}
          onClose={() => setModalState({ open: false })}
        />
      )}

      {/* Toasts */}
      {toasts.length > 0 && (
        <div className="fixed bottom-24 lg:bottom-6 right-4 z-[100] flex flex-col gap-2 max-w-sm">
          {toasts.map(t => (
            <div key={t.id} className={`rounded-xl px-4 py-3 text-sm font-medium shadow-xl border ${
              t.kind === 'ok' ? 'bg-white text-black border-transparent' : 'bg-red-500/10 text-red-200 border-red-500/20'
            }`}>{t.msg}</div>
          ))}
        </div>
      )}
    </main>
  );
}
