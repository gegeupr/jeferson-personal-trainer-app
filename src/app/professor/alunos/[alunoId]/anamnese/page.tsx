"use client";

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/utils/supabase-browser';
import Link from 'next/link';

interface Anamnese {
  id: string;
  aluno_id: string;
  data_preenchimento: string;
  historico_saude_doencas: string | null;
  historico_lesoes_cirurgias: string | null;
  medicamentos_suplementos: string | null;
  alergias: string | null;
  fumante_alcool: string | null;
  nivel_atividade_fisica_atual: string | null;
  objetivos_principais: string | null;
  restricoes_alimentares: string | null;
  disponibilidade_treino: string | null;
  observacoes_gerais: string | null;
}

interface AlunoProfile {
  nome_completo: string | null;
}

export default function AnamneseAlunoPage() {
  const router = useRouter();
  const params = useParams();
  const alunoId = params.alunoId as string;
  
  const [anamneseData, setAnamneseData] = useState<Anamnese | null>(null);
  const [alunoProfile, setAlunoProfile] = useState<AlunoProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnamnese() {
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

      const { data: anamnese, error: anamneseError } = await supabase
        .from('anamneses')
        .select('*')
        .eq('aluno_id', alunoId)
        .order('data_preenchimento', { ascending: false })
        .limit(1)
        .single();
      
      if (anamneseError && anamneseError.code !== 'PGRST116') {
        console.error('Erro ao buscar anamnese:', anamneseError.message);
        setError('Não foi possível carregar a anamnese.');
      } else if (anamnese) {
        setAnamneseData(anamnese);
      }
      
      setLoading(false);
    }
    fetchAnamnese();
  }, [router, alunoId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center text-lime-400 text-2xl">
        Carregando anamnese...
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-red-500 text-lg p-4">
        <p>{error}</p>
        <Link href="/professor/alunos" className="mt-4 bg-lime-400 text-gray-900 py-2 px-6 rounded-full hover:bg-lime-300 transition duration-300">
          Voltar para Alunos
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-lime-400 mb-4 text-center">
          Anamnese de {alunoProfile?.nome_completo || 'Aluno'}
        </h1>
        <div className="flex justify-start items-center mb-8">
          <Link href="/professor/alunos" className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-full transition duration-300">
            &larr; Voltar
          </Link>
        </div>

        {!anamneseData ? (
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl text-center">
            <p className="text-gray-400">O aluno ainda não preencheu a anamnese.</p>
          </div>
        ) : (
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl border-t-4 border-lime-400">
            <h2 className="text-2xl font-bold text-white mb-6">Dados da Anamnese</h2>
            <div className="space-y-4">
              <p className="text-gray-300">
                <span className="font-semibold text-lime-200">Histórico de Saúde e Doenças:</span> {anamneseData.historico_saude_doencas || 'N/A'}
              </p>
              <p className="text-gray-300">
                <span className="font-semibold text-lime-200">Histórico de Lesões e Cirurgias:</span> {anamneseData.historico_lesoes_cirurgias || 'N/A'}
              </p>
              <p className="text-gray-300">
                <span className="font-semibold text-lime-200">Medicamentos e Suplementos:</span> {anamneseData.medicamentos_suplementos || 'N/A'}
              </p>
              <p className="text-gray-300">
                <span className="font-semibold text-lime-200">Alergias:</span> {anamneseData.alergias || 'N/A'}
              </p>
              <p className="text-gray-300">
                <span className="font-semibold text-lime-200">Fumante / Consumo de Álcool:</span> {anamneseData.fumante_alcool || 'N/A'}
              </p>
              <p className="text-gray-300">
                <span className="font-semibold text-lime-200">Nível de Atividade Física Atual:</span> {anamneseData.nivel_atividade_fisica_atual || 'N/A'}
              </p>
              <p className="text-gray-300">
                <span className="font-semibold text-lime-200">Objetivos Principais com o Treino:</span> {anamneseData.objetivos_principais || 'N/A'}
              </p>
              <p className="text-gray-300">
                <span className="font-semibold text-lime-200">Restrições Alimentares ou Dieta:</span> {anamneseData.restricoes_alimentares || 'N/A'}
              </p>
              <p className="text-gray-300">
                <span className="font-semibold text-lime-200">Disponibilidade para Treinar:</span> {anamneseData.disponibilidade_treino || 'N/A'}
              </p>
              <p className="text-gray-300">
                <span className="font-semibold text-lime-200">Observações Gerais:</span> {anamneseData.observacoes_gerais || 'N/A'}
              </p>
              <p className="text-gray-400 text-sm mt-4">
                Última atualização: {new Date(anamneseData.data_preenchimento).toLocaleDateString()}
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}