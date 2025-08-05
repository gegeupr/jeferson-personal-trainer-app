// src/app/aluno/meus-treinos/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import Link from 'next/link';

// --- Interfaces de Dados ---
interface ExercicioDetalhes {
  id: string;
  nome: string;
  descricao: string | null;
  link_youtube: string | null;
}

interface TreinoExercicioComDetalhes {
  id: string; // ID da relação treino_exercicios
  exercicio_id: string;
  ordem: number;
  series: number | null;
  repeticoes: string | null;
  carga: string | null;
  intervalo: string | null;
  observacoes: string | null;
  exercicios: ExercicioDetalhes; // Detalhes do exercício embutidos
}

interface RotinaDiariaAluno {
  id: string;
  nome: string;
  descricao: string | null;
  created_at: string;
  treino_exercicios: TreinoExercicioComDetalhes[]; // Exercícios com detalhes
}

interface PlanoTreinoAluno {
  id: string;
  nome: string;
  descricao: string | null;
  aluno_id: string;
  professor_id: string;
  tipo_treino: string | null;
  objetivo: string | null;
  dificuldade: string | null;
  orientacao_professor: string | null;
  created_at: string;
  rotinas_do_plano: RotinaDiariaAluno[]; // Agora é um array de RotinasDiariaAluno
}

export default function MeusTreinosPage() { // MANTIDO NOME DO COMPONENTE PARA O CONTEXTO
  const router = useRouter();
  const [alunoId, setAlunoId] = useState<string | null>(null);
  const [planoAtribuido, setPlanoAtribuido] = useState<PlanoTreinoAluno | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRotinaId, setExpandedRotinaId] = useState<string | null>(null); // Estado para expandir rotina

  useEffect(() => {
    async function fetchMeusTreinos() {
      setLoading(true);
      setError(null);

      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push('/login');
        return;
      }
      setAlunoId(user.id);

      // 1. Verifica se o usuário é aluno (lendo do JWT)
      const userRole = user.app_metadata?.user_role as string || null;
      if (userRole !== 'aluno') {
        setError('Acesso negado. Esta página é apenas para alunos.');
        setLoading(false);
        return;
      }

      // 2. Busca o Plano de Treino atribuído a este aluno, com suas rotinas e exercícios
      const { data: planosData, error: planosError } = await supabase
        .rpc('get_treino_atribuido_com_exercicios', { p_aluno_id: user.id });


      if (planosError) {
        console.error('Erro ao buscar planos de treino do aluno:', planosError.message);
        setError('Não foi possível carregar seu treino. ' + planosError.message);
      } else if (!planosData || planosData.length === 0) {
        setPlanoAtribuido(null); // Nenhum plano atribuído
      } else {
        const rawPlano = planosData[0]; // Pega o primeiro plano atribuído
        
        // Mapear a estrutura da RPC para a interface PlanoTreinoAluno
        const mappedPlano: PlanoTreinoAluno = {
            id: rawPlano.id,
            nome: rawPlano.nome,
            descricao: rawPlano.descricao,
            aluno_id: rawPlano.aluno_id,
            professor_id: rawPlano.professor_id,
            tipo_treino: rawPlano.tipo_treino,
            objetivo: rawPlano.objetivo,
            dificuldade: rawPlano.dificuldade,
            orientacao_professor: rawPlano.orientacao_professor,
            created_at: rawPlano.created_at,
            rotinas_do_plano: (rawPlano.rotinas_do_plano || []).map((rotina: any) => ({
                id: rotina.id,
                nome: rotina.nome,
                descricao: rotina.descricao,
                created_at: rotina.created_at,
                treino_exercicios: rotina.treino_exercicios || [], // Exercícios já vêm detalhados
            })),
        };
        
        setPlanoAtribuido(mappedPlano);
      }
      setLoading(false);
    }

    fetchMeusTreinos();
  }, [router]);

  const toggleRotinaExpansion = (rotinaId: string) => {
    setExpandedRotinaId(prevId => (prevId === rotinaId ? null : rotinaId));
  };


  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center text-lime-400 text-2xl">
        Carregando seu treino...
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
        <h1 className="text-4xl font-bold text-lime-400 mb-8 text-center">
          Meus Treinos
        </h1>

        {/* Botão Voltar ao Dashboard */}
        <div className="flex justify-start items-center mb-8">
          <Link href="/dashboard" className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-full transition duration-300">
            &larr; Voltar ao Dashboard
          </Link>
        </div>

        {!planoAtribuido ? (
          <section className="bg-gray-800 p-8 rounded-lg shadow-xl border-t-4 border-lime-400 text-center">
            <h2 className="text-2xl font-bold text-white mb-4">Nenhum Plano de Treino Atribuído</h2>
            <p className="text-gray-400 text-lg">
              Seu professor ainda não atribuiu nenhum plano de treino. Fale com ele para começar sua jornada!
            </p>
            <Link href="/dashboard" className="mt-8 inline-block bg-lime-400 text-gray-900 font-bold py-3 px-8 rounded-full hover:bg-lime-300 transition duration-300 text-lg">
              Voltar ao Dashboard
            </Link>
          </section>
        ) : (
          <section className="bg-gray-800 p-8 rounded-lg shadow-xl border-t-4 border-lime-400">
            <h2 className="text-3xl font-bold text-lime-400 mb-4">{planoAtribuido.nome}</h2>
            {planoAtribuido.descricao && (
              <p className="text-gray-300 text-lg mb-6">{planoAtribuido.descricao}</p>
            )}
            <p className="text-gray-300 mb-2">
                <span className="font-medium text-lime-200">Tipo:</span> {planoAtribuido.tipo_treino || 'N/A'}
            </p>
            <p className="text-gray-300 mb-2">
                <span className="font-medium text-lime-200">Objetivo:</span> {planoAtribuido.objetivo || 'N/A'}
            </p>
            <p className="text-gray-300 mb-2">
                <span className="font-medium text-lime-200">Dificuldade:</span> {planoAtribuido.dificuldade || 'N/A'}
            </p>
            <p className="text-gray-300 mb-6">
                <span className="font-medium text-lime-200">Orientação do Professor:</span> {planoAtribuido.orientacao_professor || 'N/A'}
            </p>


            <h3 className="text-2xl font-bold text-white mb-6">Rotinas Diárias</h3>
            <div className="space-y-4">
              {planoAtribuido.rotinas_do_plano.length === 0 ? (
                <p className="text-gray-400">Este plano não possui rotinas diárias atribuídas ainda.</p>
              ) : (
                planoAtribuido.rotinas_do_plano.map((rotina, rotinaIndex) => (
                  <div key={rotina.id} className="bg-gray-900 p-6 rounded-lg border border-gray-700">
                    <button
                      type="button"
                      onClick={() => toggleRotinaExpansion(rotina.id)}
                      className="w-full text-left text-xl font-bold text-lime-300 hover:text-lime-400 flex justify-between items-center"
                    >
                      {rotina.nome}
                      <svg className={`w-6 h-6 transform transition-transform ${expandedRotinaId === rotina.id ? 'rotate-180' : 'rotate-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </button>
                    {rotina.descricao && <p className="text-gray-400 text-sm mt-1">{rotina.descricao}</p>}

                    {expandedRotinaId === rotina.id && (
                      <div className="mt-4 space-y-6">
                        {rotina.treino_exercicios.length === 0 ? (
                          <p className="text-gray-400 text-center">Nenhum exercício nesta rotina.</p>
                        ) : (
                          rotina.treino_exercicios.sort((a, b) => a.ordem - b.ordem).map((exTreino, exIndex) => (
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
                                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"></path><path fillRule="evenodd" d="M.05 4.555A2 2 0 012 2.5h16A2 2 0 0119.95 4.555L10 14.555 0.05 4.555zM18 6V4a2 2 0 00-2-2H4a2 2 0 00-2 2v2H.05A2 2 0 010 4.5V15a2 2 0 002 2h16a2 2 0 002-2V4.5A2 2 0 0119.95 4.555L10 14.555 0.05 4.555z" clipRule="evenodd"></path></svg>
                                  Ver Vídeo
                                </a>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}