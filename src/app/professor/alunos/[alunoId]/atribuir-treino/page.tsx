"use client";

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import Link from 'next/link';

interface PlanoTreino {
  id: string;
  nome: string;
  descricao: string | null;
  aluno_id: string | null;
  tipo_treino: string | null;
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

  useEffect(() => {
    async function fetchTreinos() {
      setLoading(true);
      setError(null);

      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push('/login');
        return;
      }
      
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
        
      if (profileError || profile?.role !== 'professor') {
        setError('Acesso negado.');
        setLoading(false);
        return;
      }
      
      // Busca o nome do aluno para exibição
      const { data: alunoData, error: alunoError } = await supabase
        .from('profiles')
        .select('nome_completo')
        .eq('id', alunoId)
        .single();
      
      if (alunoError || !alunoData) {
          setError('Aluno não encontrado.');
          setLoading(false);
          return;
      }
      setAlunoProfile(alunoData);

      // Busca todos os planos de treino criados pelo professor, independentemente de estarem atribuídos
      const { data: treinosData, error: treinosError } = await supabase
        .from('treinos')
        .select('id, nome, descricao, aluno_id, tipo_treino')
        .eq('professor_id', user.id);
      
      if (treinosError) {
        console.error('Erro ao buscar treinos:', treinosError.message);
        setError('Não foi possível carregar a lista de treinos.');
      } else {
        setPlanosTreino(treinosData || []);
      }
      
      setLoading(false);
    }
    fetchTreinos();
  }, [router, alunoId]);

  const handleAtribuirTreino = async (treinoId: string) => {
    if (!confirm('Tem certeza que deseja atribuir este treino a este aluno?')) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('treinos')
        .update({ aluno_id: alunoId })
        .eq('id', treinoId);

      if (updateError) throw updateError;
      
      alert('Treino atribuído com sucesso!');
      router.push(`/professor/dashboard`); // Redireciona para o dashboard principal
      
    } catch (err: any) {
      console.error('Erro ao atribuir treino:', err.message);
      setError('Erro ao atribuir treino: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
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
        <Link href={`/professor/dashboard`} className="mt-4 bg-lime-400 text-gray-900 py-2 px-6 rounded-full hover:bg-lime-300 transition duration-300">
          Voltar para o dashboard
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-lime-400 mb-4 text-center">
          Atribuir Treino para {alunoProfile?.nome_completo || 'Aluno'}
        </h1>
        <div className="flex justify-start items-center mb-8">
          <Link href={`/professor/dashboard`} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-full transition duration-300">
            &larr; Voltar
          </Link>
        </div>

        <section className="bg-gray-800 p-8 rounded-lg shadow-xl border-t-4 border-blue-600">
          <h2 className="text-2xl font-bold text-white mb-6">Planos de Treino Disponíveis</h2>
          
          {planosTreino.length === 0 ? (
            <p className="text-gray-400 text-center">Nenhum plano de treino disponível. Crie um na sua biblioteca.</p>
          ) : (
            <ul className="space-y-4">
              {planosTreino.map(treino => (
                <li key={treino.id} className="bg-gray-900 p-4 rounded-lg flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
                  <div className="text-left">
                    <span className="text-lime-300 font-semibold">{treino.nome}</span>
                    <p className="text-gray-400 text-sm">Tipo: {treino.tipo_treino || 'N/A'}</p>
                    <p className="text-gray-400 text-sm">Status: {treino.aluno_id ? 'Já atribuído' : 'Não atribuído'}</p>
                  </div>
                  <button
                    onClick={() => handleAtribuirTreino(treino.id)}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-full transition duration-300"
                    disabled={isSubmitting || treino.aluno_id !== null}
                  >
                    {treino.aluno_id ? 'Treino Atribuído' : 'Atribuir'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}