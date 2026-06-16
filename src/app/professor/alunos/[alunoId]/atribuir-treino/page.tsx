"use client";

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/utils/supabase-browser';
import Link from 'next/link';
import { atribuirTreinoAoAluno } from '@/app/actions/treinos';

interface PlanoTreino {
  id: string;
  nome: string;
  descricao: string | null;
  aluno_id: string | null;
  tipo_treino: string | null;
  gerado_por_ia: boolean;
}

interface AlunoProfile {
  nome_completo: string | null;
}

export default function AtribuirTreinoPage() {
  const router = useRouter();
  const params = useParams();
  const alunoId = params.alunoId as string;

  const [planosTreino, setPlanosTreino] = useState<PlanoTreino[]>([]);
  const [alunoProfile, setAlunoProfile] = useState<AlunoProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: "ok" | "err" }[]>([]);
  const [confirmState, setConfirmState] = useState<{ msg: string; onOk: () => void } | null>(null);

  function pushToast(msg: string, kind: "ok" | "err") {
    const id = Date.now();
    setToasts((p) => [...p, { id, msg, kind }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3000);
  }

  function showConfirm(msg: string, onOk: () => void) { setConfirmState({ msg, onOk }); }

  useEffect(() => {
    async function fetchTreinos() {
      setLoading(true);
      setError(null);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { router.push('/login'); return; }

      const { data: profile, error: profileError } = await supabase
        .from('profiles').select('role').eq('id', user.id).single();
      if (profileError || profile?.role !== 'professor') {
        setError('Acesso negado.');
        setLoading(false);
        return;
      }

      const { data: alunoData, error: alunoError } = await supabase
        .from('profiles').select('nome_completo').eq('id', alunoId).single();
      if (alunoError || !alunoData) {
        setError('Aluno não encontrado.');
        setLoading(false);
        return;
      }
      setAlunoProfile(alunoData);

      const { data: treinosData, error: treinosError } = await supabase
        .from('treinos')
        .select('id, nome, descricao, aluno_id, tipo_treino, gerado_por_ia')
        .eq('professor_id', user.id);

      if (treinosError) {
        setError('Não foi possível carregar a lista de treinos.');
      } else {
        setPlanosTreino((treinosData as PlanoTreino[]) || []);
      }

      setLoading(false);
    }
    fetchTreinos();
  }, [router, alunoId]);

  const handleAtribuirTreino = (treinoId: string) => {
    showConfirm('Atribuir este treino ao aluno?', async () => {
      setIsSubmitting(true);
      setError(null);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const profId = auth?.user?.id;
        if (!profId) throw new Error('Sessão expirada. Faça login novamente.');

        const result = await atribuirTreinoAoAluno(treinoId, alunoId, profId);
        if (!result.ok) throw new Error(result.error);
        pushToast('Treino atribuído com sucesso!', 'ok');
        setPlanosTreino((prev) => prev.map((t) => t.id === treinoId ? { ...t, aluno_id: alunoId } : t));
      } catch (err: any) {
        setError('Erro ao atribuir treino: ' + err.message);
      } finally {
        setIsSubmitting(false);
      }
    });
  };

  const handleDesatribuirTreino = (treino: PlanoTreino) => {
    showConfirm(`Remover "${treino.nome}" deste aluno? O treino continua na sua biblioteca.`, async () => {
      setIsSubmitting(true);
      setError(null);
      try {
        const { error: updErr } = await supabase
          .from('treinos')
          .update({ aluno_id: null })
          .eq('id', treino.id);
        if (updErr) throw updErr;
        setPlanosTreino((prev) => prev.map((t) => t.id === treino.id ? { ...t, aluno_id: null } : t));
        pushToast('Treino removido do aluno.', 'ok');
      } catch (err: any) {
        setError('Erro ao desatribuir treino: ' + err.message);
      } finally {
        setIsSubmitting(false);
      }
    });
  };

  const alunoNome = alunoProfile?.nome_completo || 'Aluno';

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-white/40 text-sm">Carregando treinos…</p>
      </div>
    );
  }

  if (error && !planosTreino.length) {
    return (
      <div className="p-6 max-w-lg mx-auto mt-10">
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
          <p className="text-red-300 text-sm font-medium">Erro</p>
          <p className="mt-1 text-white/60 text-sm">{error}</p>
          <Link href="/professor/alunos" className="mt-4 inline-block rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 hover:bg-white/10 transition-colors">
            ← Alunos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-white/40">
          <Link href="/professor/alunos" className="hover:text-white/70 transition-colors">Alunos</Link>
          <span>/</span>
          <Link href={`/professor/alunos/${alunoId}/detalhes`} className="hover:text-white/70 transition-colors">{alunoNome}</Link>
          <span>/</span>
          <span className="text-white/60">Atribuir treino</span>
        </div>

        <h1 className="text-2xl font-bold text-white">Atribuir treino</h1>

        {error && (
          <div className="rounded-xl border border-red-400/15 bg-red-400/8 px-4 py-3 text-sm text-red-300">{error}</div>
        )}

        {planosTreino.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-8 text-center">
            <p className="text-white/40 text-sm">Nenhum plano de treino disponível. Crie um na página de Treinos.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] divide-y divide-white/8">
            {planosTreino.map((treino) => (
              <div key={treino.id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white truncate">{treino.nome}</p>
                    {treino.gerado_por_ia && (
                      <span className="shrink-0 rounded-full border border-white/15 bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-white/60">
                        IA
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/40 mt-0.5">
                    {treino.tipo_treino || 'Sem tipo'} · {treino.aluno_id ? 'Atribuído' : 'Disponível'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/professor/alunos/${alunoId}/treino/${treino.id}`}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 hover:bg-white/10 transition-colors"
                  >
                    Ver
                  </Link>
                  {treino.aluno_id === alunoId ? (
                    <button
                      onClick={() => handleDesatribuirTreino(treino)}
                      disabled={isSubmitting}
                      className="rounded-xl border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/50 hover:bg-white/10 disabled:opacity-40 transition-colors"
                    >
                      Desatribuir
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAtribuirTreino(treino.id)}
                      disabled={isSubmitting || treino.aluno_id !== null}
                      className="rounded-xl bg-white px-4 py-1.5 text-xs font-semibold text-black hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {treino.aluno_id ? 'Atribuído a outro' : 'Atribuir'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {toasts.length > 0 && (
        <div className="fixed bottom-24 lg:bottom-6 right-4 z-[100] flex flex-col gap-2 max-w-sm">
          {toasts.map((t) => (
            <div key={t.id} className={`rounded-xl px-4 py-3 text-sm font-medium shadow-xl border ${
              t.kind === "ok" ? "bg-white text-black border-transparent" : "bg-red-500/10 text-red-200 border-red-500/20"
            }`}>{t.msg}</div>
          ))}
        </div>
      )}

      {confirmState && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-6 max-w-sm w-full">
            <p className="text-white text-sm">{confirmState.msg}</p>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setConfirmState(null)} className="border border-white/10 bg-white/5 px-4 py-2 rounded-xl text-sm text-white/70 hover:bg-white/10 transition-colors">Cancelar</button>
              <button onClick={() => { confirmState.onOk(); setConfirmState(null); }} className="bg-white text-black px-4 py-2 rounded-xl text-sm font-semibold hover:bg-white/90 transition-colors">Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
