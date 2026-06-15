"use client";

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/utils/supabase-browser';
import Link from 'next/link';

type ExercicioEdit = {
  te_id: string;
  rotina_id: string;
  ordem: number;
  nome: string;
  series: number;
  repeticoes: string;
  intervalo: string;
  observacoes: string;
  removido: boolean;
};

type RotinaInfo = {
  id: string;
  nome: string;
  descricao: string;
};

type TreinoMeta = {
  id: string;
  nome: string;
  descricao: string;
  gerado_por_ia: boolean;
};

export default function VerEditarTreinoPage() {
  const router = useRouter();
  const params = useParams();
  const alunoId = params.alunoId as string;
  const treinoId = params.treinoId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: 'ok' | 'err' }[]>([]);

  const [treino, setTreino] = useState<TreinoMeta | null>(null);
  const [rotinas, setRotinas] = useState<RotinaInfo[]>([]);
  const [exercicios, setExercicios] = useState<ExercicioEdit[]>([]);

  function pushToast(msg: string, kind: 'ok' | 'err') {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, kind }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }

  useEffect(() => {
    async function fetchData() {
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
        id: treinoData.id,
        nome: treinoData.nome,
        descricao: (treinoData as any).descricao || '',
        gerado_por_ia: (treinoData as any).gerado_por_ia ?? false,
      });

      const { data: rotinasData } = await supabase
        .from('rotinas_diarias')
        .select('id, nome, descricao')
        .eq('plano_id', treinoId)
        .order('nome');

      const rotinasList: RotinaInfo[] = (rotinasData || []).map((r: any) => ({
        id: r.id,
        nome: r.nome,
        descricao: r.descricao || '',
      }));
      setRotinas(rotinasList);

      if (rotinasList.length === 0) { setLoading(false); return; }

      const rotinaIds = rotinasList.map(r => r.id);

      const { data: exData } = await supabase
        .from('treino_exercicios')
        .select('id, rotina_id, ordem, series, repeticoes, intervalo, observacoes, exercicio_id, catalogo_id')
        .in('rotina_id', rotinaIds)
        .order('ordem');

      const catIds = (exData || []).filter((e: any) => e.catalogo_id).map((e: any) => e.catalogo_id as string);
      const bibIds = (exData || []).filter((e: any) => e.exercicio_id).map((e: any) => e.exercicio_id as string);

      const [catRes, bibRes] = await Promise.all([
        catIds.length > 0
          ? supabase.from('exercicios_catalogo').select('id, nome').in('id', catIds)
          : Promise.resolve({ data: [] }),
        bibIds.length > 0
          ? supabase.from('exercicios').select('id, nome').in('id', bibIds)
          : Promise.resolve({ data: [] }),
      ]);

      const catMap = new Map((catRes.data || []).map((e: any) => [e.id, e.nome as string]));
      const bibMap = new Map((bibRes.data || []).map((e: any) => [e.id, e.nome as string]));

      setExercicios((exData || []).map((e: any) => ({
        te_id: e.id,
        rotina_id: e.rotina_id,
        ordem: e.ordem,
        nome: (e.catalogo_id ? catMap.get(e.catalogo_id) : bibMap.get(e.exercicio_id)) || 'Exercício desconhecido',
        series: e.series ?? 3,
        repeticoes: e.repeticoes ?? '10',
        intervalo: e.intervalo ?? '',
        observacoes: e.observacoes ?? '',
        removido: false,
      })));

      setLoading(false);
    }
    fetchData();
  }, [treinoId, router]);

  function updateExercicio(teId: string, patch: Partial<ExercicioEdit>) {
    setExercicios(prev => prev.map(ex => ex.te_id === teId ? { ...ex, ...patch } : ex));
    setDirty(true);
  }

  function removeExercicio(teId: string) {
    setExercicios(prev => prev.map(ex => ex.te_id === teId ? { ...ex, removido: true } : ex));
    setDirty(true);
  }

  async function handleSave() {
    if (!treino) return;
    setSaving(true);
    try {
      const { error: tErr } = await supabase
        .from('treinos')
        .update({ nome: treino.nome, descricao: treino.descricao })
        .eq('id', treinoId);
      if (tErr) throw tErr;

      for (const ex of exercicios.filter(e => !e.removido)) {
        const { error: exErr } = await supabase
          .from('treino_exercicios')
          .update({
            series: ex.series,
            repeticoes: ex.repeticoes,
            intervalo: ex.intervalo || null,
            observacoes: ex.observacoes || null,
          })
          .eq('id', ex.te_id);
        if (exErr) throw exErr;
      }

      for (const ex of exercicios.filter(e => e.removido)) {
        await supabase.from('treino_exercicios').delete().eq('id', ex.te_id);
      }

      setExercicios(prev => prev.filter(e => !e.removido));
      setDirty(false);
      pushToast('Alterações salvas!', 'ok');
    } catch (e: any) {
      pushToast('Erro ao salvar: ' + (e?.message ?? 'desconhecido'), 'err');
    } finally {
      setSaving(false);
    }
  }

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
          <p className="text-xs text-white/25">{rotinas.length} rotina{rotinas.length !== 1 ? 's' : ''} · {totalAtivos} exercício{totalAtivos !== 1 ? 's' : ''}</p>
        </div>

        {/* Rotinas */}
        {rotinas.map(rotina => {
          const exsRotina = exercicios.filter(e => e.rotina_id === rotina.id && !e.removido);
          const letra = rotina.nome.match(/Treino\s+([A-Z])/)?.[1] ?? rotina.nome[0]?.toUpperCase() ?? '?';

          return (
            <div key={rotina.id} className="rounded-2xl border border-white/8 bg-white/[0.03] overflow-hidden">
              <div className="px-5 py-3 border-b border-white/8 flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-white/8 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-white/60">{letra}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{rotina.nome}</p>
                  {rotina.descricao && <p className="text-xs text-white/35 truncate">{rotina.descricao}</p>}
                </div>
                <span className="ml-auto shrink-0 text-xs text-white/25">{exsRotina.length} ex.</span>
              </div>

              <div className="divide-y divide-white/5">
                {exsRotina.length === 0 && (
                  <p className="px-5 py-4 text-xs text-white/25 text-center">Todos os exercícios foram removidos</p>
                )}
                {exsRotina.map(ex => (
                  <div key={ex.te_id} className="px-5 py-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-sm font-medium text-white">{ex.nome}</span>
                      <button
                        onClick={() => removeExercicio(ex.te_id)}
                        title="Remover exercício"
                        className="shrink-0 text-white/20 hover:text-red-400 transition-colors text-xl leading-none"
                      >×</button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-white/30 uppercase tracking-wide">Séries</label>
                        <input
                          type="number"
                          min={1} max={10}
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
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer — salvar */}
      <div className={`fixed bottom-16 lg:bottom-0 left-0 right-0 px-4 py-3 bg-[#0a0a0a]/95 border-t border-white/8 backdrop-blur-sm z-40 transition-opacity ${dirty ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
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
