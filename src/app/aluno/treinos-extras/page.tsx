"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import Link from 'next/link';

// Tipos de dados
interface ExercicioDetalhes {
  id: string;
  nome: string;
  descricao: string | null;
  link_youtube: string | null;
}

interface TreinoExtraExercicio {
  id: string;
  exercicio_id: string;
  ordem: number;
  series: number | null;
  repeticoes: string | null;
  carga: string | null;
  intervalo: string | null;
  observacoes: string | null;
  exercicios: ExercicioDetalhes;
}

interface TreinoExtra {
  id: string;
  nome: string;
  descricao: string | null;
  created_at: string;
  treinos_extras_exercicios: TreinoExtraExercicio[];
}

export default function MeusTreinosExtrasPage() {
  const router = useRouter();
  const [alunoId, setAlunoId] = useState<string | null>(null);
  const [treinosExtras, setTreinosExtras] = useState<TreinoExtra[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTreinoId, setExpandedTreinoId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTreinosExtras() {
      setLoading(true);
      setError(null);

      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push('/login');
        return;
      }
      setAlunoId(user.id);

      const userRole = user.app_metadata?.user_role as string | null;
      if (userRole !== 'aluno') {
        setError('Acesso negado. Esta página é apenas para alunos.');
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('treinos_extras')
        .select(`
          id,
          nome,
          descricao,
          created_at,
          treinos_extras_exercicios (
            id,
            exercicio_id,
            ordem,
            series,
            repeticoes,
            carga,
            intervalo,
            observacoes,
            exercicios!treinos_extras_exercicios_exercicio_id_fkey(id, nome, descricao, link_youtube)
          )
        `)
        .eq('aluno_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Erro ao buscar treinos extras:', fetchError.message);
        setError('Não foi possível carregar seus treinos extras: ' + fetchError.message);
      } else {
        setTreinosExtras(data as TreinoExtra[] || []);
      }
      setLoading(false);
    }

    fetchTreinosExtras();
  }, [router]);

  const toggleTreinoExpansion = (treinoId: string) => {
    setExpandedTreinoId(prevId => (prevId === treinoId ? null : treinoId));
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center text-lime-400 text-2xl">
        Carregando treinos extras...
      </main>
    );
  }

  if (error && error.includes('Acesso negado')) {
    return (
      <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-red-500 text-lg p-4">
        <p>{error}</p>
        <Link href="/dashboard" className="mt-4 bg-lime-400 text-gray-900 py-2 px-6 rounded-full hover:bg-lime-300 transition duration-300">
          Ir para Dashboard
        </Link>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-red-500 text-lg p-4">
        <p>{error}</p>
        <button
          onClick={() => setError(null)}
          className="mt-4 bg-lime-400 text-gray-900 py-2 px-6 rounded-full hover:bg-lime-300 transition duration-300"
        >
          Tentar Novamente
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-lime-400 mb-8 text-center">Meus Treinos Extras</h1>

        {/* Botão Voltar ao Dashboard */}
        <div className="flex justify-start items-center mb-8">
          <Link href="/dashboard" className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-full transition duration-300">
            &larr; Voltar ao Dashboard
          </Link>
        </div>

        {treinosExtras.length === 0 ? (
          <section className="bg-gray-800 p-8 rounded-lg shadow-xl border-t-4 border-lime-400 text-center">
            <h2 className="text-2xl font-bold text-white mb-4">Nenhum Treino Extra Atribuído</h2>
            <p className="text-gray-400 text-lg">
              Seu professor ainda não atribuiu nenhum treino extra.
            </p>
          </section>
        ) : (
          <section className="bg-gray-800 p-8 rounded-lg shadow-xl border-t-4 border-lime-400">
            <h2 className="text-2xl font-bold text-white mb-6">Treinos Extras Recebidos</h2>
            <div className="space-y-4">
              {treinosExtras.map(treino => (
                <div key={treino.id} className="bg-gray-900 p-6 rounded-lg border border-gray-700">
                  <button
                    type="button"
                    onClick={() => toggleTreinoExpansion(treino.id)}
                    className="w-full text-left text-xl font-bold text-lime-300 hover:text-lime-400 flex justify-between items-center"
                  >
                    {treino.nome}
                    <svg
                      className={`w-6 h-6 transform transition-transform ${
                        expandedTreinoId === treino.id ? 'rotate-180' : 'rotate-0'
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                  </button>
                  {treino.descricao && <p className="text-gray-400 text-sm mt-1">{treino.descricao}</p>}

                  {expandedTreinoId === treino.id && (
                    <div className="mt-4 space-y-6">
                      {treino.treinos_extras_exercicios.length === 0 ? (
                        <p className="text-gray-400 text-center">Nenhum exercício neste treino extra.</p>
                      ) : (
                        treino.treinos_extras_exercicios.sort((a, b) => a.ordem - b.ordem).map((exTreino, exIndex) => (
                          <div key={exTreino.id} className="bg-gray-700 p-4 rounded-lg border border-gray-600">
                            <h4 className="text-xl font-bold text-white mb-2">
                              {exIndex + 1}. {exTreino.exercicios.nome}
                            </h4>
                            {exTreino.exercicios.descricao && (
                              <p className="text-gray-300 text-sm mb-2">{exTreino.exercicios.descricao}</p>
                            )}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm text-gray-400 mb-4">
                              {exTreino.series && <p><strong>Séries:</strong> {exTreino.series}</p>}
                              {exTreino.repeticoes && <p><strong>Repetições:</strong> {exTreino.repeticoes}</p>}
                              {exTreino.carga && <p><strong>Carga:</strong> {exTreino.carga}</p>}
                              {exTreino.intervalo && <p><strong>Intervalo:</strong> {exTreino.intervalo}</p>}
                            </div>
                            {exTreino.observacoes && (
                              <p className="text-gray-300 text-sm mb-4">
                                <strong>Obs:</strong> {exTreino.observacoes}
                              </p>
                            )}
                            {exTreino.exercicios.link_youtube && (
                              <a
                                href={exTreino.exercicios.link_youtube}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full text-sm inline-flex items-center transition duration-300"
                              >
                                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"></path>
                                  <path
                                    fillRule="evenodd"
                                    d="M.05 4.555A2 2 0 012 2.5h16A2 2 0 0119.95 4.555L10 14.555 0.05 4.555zM18 6V4a2 2 0 00-2-2H4a2 2 0 00-2 2v2H.05A2 2 0 010 4.5V15a2 2 0 002 2h16a2 2 0 002-2V4.5A2 2 0 0119.95 4.555L10 14.555 0.05 4.555z"
                                    clipRule="evenodd"
                                  ></path>
                                </svg>
                                Ver Vídeo
                              </a>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}