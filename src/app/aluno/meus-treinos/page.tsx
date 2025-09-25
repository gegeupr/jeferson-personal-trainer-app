"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import Link from 'next/link';

// --- Interfaces de Dados ---
interface Exercicio {
  id: string;
  nome: string;
  link_youtube: string | null;
  descricao: string | null;
}

interface TreinoExercicio {
  ordem: number;
  series: number | null;
  repeticoes: string | null;
  carga: string | null;
  intervalo: string | null;
  observacoes: string | null;
  exercicios: Exercicio | null; // Corrigido para permitir que seja null
}

interface RotinaDiaria {
  id: string;
  nome: string;
  descricao: string | null;
  treino_exercicios: TreinoExercicio[];
}

interface PlanoTreino {
  id: string;
  nome: string;
  descricao: string | null;
  tipo_treino: string | null;
  objetivo: string | null;
  dificuldade: string | null;
  orientacao_professor: string | null;
  professor_id: string;
  rotinas_diarias: RotinaDiaria[];
}

export default function MeusTreinosPage() {
  const router = useRouter();
  const [treinos, setTreinos] = useState<PlanoTreino[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRotinas, setExpandedRotinas] = useState<string[]>([]);

  useEffect(() => {
    async function fetchTreinosDoAluno() {
      setLoading(true);
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push('/login');
        return;
      }
      
      const { data: treinosData, error: treinosError } = await supabase
        .from('treinos')
        .select(`
          id,
          nome,
          descricao,
          tipo_treino,
          objetivo,
          dificuldade,
          orientacao_professor,
          professor_id,
          rotinas_diarias(
            id,
            nome,
            descricao,
            treino_exercicios(
              ordem,
              series,
              repeticoes,
              carga,
              intervalo,
              observacoes,
              exercicios(
                id,
                nome,
                link_youtube,
                descricao
              )
            )
          )
        `)
        .eq('aluno_id', user.id);
        
      if (treinosError) {
        console.error('Erro ao buscar treinos:', treinosError.message);
        setError('Não foi possível carregar seus treinos.');
      } else {
        const planosComExercicios = treinosData?.map((plano: any) => {
          const rotinasComExercicios = (plano.rotinas_diarias || []).map((rotina: any) => {
            const exercicios = (rotina.treino_exercicios || []).map((te: any) => {
              // Acessa diretamente a propriedade 'exercicios'
              return { ...te, exercicios: te.exercicios };
            });
            return { ...rotina, treino_exercicios: exercicios };
          });
          return { ...plano, rotinas_diarias: rotinasComExercicios };
        });
        setTreinos(planosComExercicios as PlanoTreino[] || []);
      }
      
      setLoading(false);
    }

    fetchTreinosDoAluno();
  }, [router]);
  
  const handleToggleRotina = (rotinaId: string) => {
    setExpandedRotinas(prev => 
      prev.includes(rotinaId) 
      ? prev.filter(id => id !== rotinaId)
      : [...prev, rotinaId]
    );
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center text-lime-400 text-2xl">
        Carregando treinos...
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-red-500 text-lg p-4">
        <p>{error}</p>
        <Link href="/dashboard" className="mt-4 bg-lime-400 text-gray-900 py-2 px-6 rounded-full hover:bg-lime-300 transition duration-300">
          Voltar ao Dashboard
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-lime-400 mb-8 text-center">Meus Planos de Treino</h1>

        <div className="flex justify-start items-center mb-8">
          <Link href="/dashboard" className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-full transition duration-300">
            &larr; Voltar ao Dashboard
          </Link>
        </div>

        {treinos.length === 0 ? (
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl text-center">
            <p className="text-gray-400">Nenhum treino foi atribuído a você ainda.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {treinos.map(treino => (
              <div key={treino.id} className="bg-gray-800 p-6 rounded-lg shadow-md border-t-4 border-blue-600">
                <h2 className="text-2xl font-semibold text-lime-300 mb-2">{treino.nome}</h2>
                <p className="text-gray-300 mb-1">
                  <span className="font-medium text-lime-200">Professor:</span> {treino.professor_id}
                </p>
                <p className="text-gray-300 mb-1">
                  <span className="font-medium text-lime-200">Tipo:</span> {treino.tipo_treino || 'N/A'}
                </p>
                <p className="text-gray-300 mb-1">
                  <span className="font-medium text-lime-200">Objetivo:</span> {treino.objetivo || 'N/A'}
                </p>
                <p className="text-gray-300 mb-1">
                  <span className="font-medium text-lime-200">Dificuldade:</span> {treino.dificuldade || 'N/A'}
                </p>
                <p className="text-gray-300 mb-4">
                  <span className="font-medium text-lime-200">Orientação:</span> {treino.orientacao_professor || 'N/A'}
                </p>
                
                <h3 className="text-xl font-semibold text-lime-300 mb-2">Rotinas Diárias:</h3>
                {treino.rotinas_diarias.length > 0 ? (
                  <ul className="space-y-4">
                    {treino.rotinas_diarias.map(rotina => (
                      <li key={rotina.id}>
                        <button
                          onClick={() => handleToggleRotina(rotina.id)}
                          className="w-full text-left bg-gray-700 hover:bg-gray-600 text-white p-3 rounded-lg flex justify-between items-center"
                          type="button"
                        >
                          <span>{rotina.nome} ({rotina.treino_exercicios.length} exercícios)</span>
                          <span>{expandedRotinas.includes(rotina.id) ? '▲' : '▼'}</span>
                        </button>
                        {expandedRotinas.includes(rotina.id) && (
                          <div className="mt-2 bg-gray-700 p-4 rounded-lg space-y-4">
                            {rotina.descricao && (
                              <p className="text-gray-300 text-sm italic">Descrição: {rotina.descricao}</p>
                            )}
                            {rotina.treino_exercicios.map((ex, index) => (
                              <div key={index} className="bg-gray-600 p-3 rounded-lg flex flex-col space-y-2">
                                <h4 className="text-md font-semibold text-lime-200">
                                  {index + 1}. {ex.exercicios?.nome || 'Exercício Desconhecido'}
                                </h4>
                                <div className="flex flex-wrap gap-x-4 text-sm text-gray-300">
                                  {ex.series && <span>Séries: <span className="font-bold">{ex.series}</span></span>}
                                  {ex.repeticoes && <span>Repetições: <span className="font-bold">{ex.repeticoes}</span></span>}
                                  {ex.carga && <span>Carga: <span className="font-bold">{ex.carga}</span></span>}
                                  {ex.intervalo && <span>Intervalo: <span className="font-bold">{ex.intervalo}</span></span>}
                                </div>
                                {ex.observacoes && (
                                  <p className="text-sm italic text-gray-400 mt-1">Obs: {ex.observacoes}</p>
                                )}
                                {ex.exercicios?.link_youtube && (
                                  <a 
                                    href={ex.exercicios.link_youtube} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="text-blue-400 hover:underline text-sm mt-1"
                                  >
                                    Ver Vídeo
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-400 text-sm">Nenhuma rotina diária adicionada a este plano.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}