// src/app/professor/alunos/[alunoId]/detalhes/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import Link from 'next/link';

interface AnamneseData {
  historico_saude_doencas: string;
  historico_lesoes_cirurgias: string;
  medicamentos_suplementos: string;
  alergias: string;
  fumante_alcool: string;
  nivel_atividade_fisica_atual: string;
  objetivos_principais: string;
  restricoes_alimentares: string;
  disponibilidade_treino: string;
  observacoes_gerais: string;
  // Adicione outras propriedades se houver
}

interface AlunoInfo {
  id: string;
  nome_completo: string | null;
  email: string;
}

export default function AlunoDetalhesPage() {
  const router = useRouter();
  const params = useParams();
  const alunoId = params.alunoId as string;

  const [alunoInfo, setAlunoInfo] = useState<AlunoInfo | null>(null);
  const [anamneseData, setAnamneseData] = useState<AnamneseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [professorId, setProfessorId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }
      setProfessorId(user.id);

      // 1. Verifica se o usuário é professor
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError || !profile || profile.role !== 'professor') {
        setError('Acesso negado. Apenas professores podem ver detalhes de alunos.');
        setLoading(false);
        return;
      }

      // 2. Buscar informações do aluno específico (perfil e email)
      if (!alunoId) {
        setError('ID do aluno não fornecido na URL.');
        setLoading(false);
        return;
      }

      // Reutiliza a função que já busca perfil + email
      const { data: allAlunosData, error: alunosFunctionError } = await supabase
        .rpc('get_all_aluno_profiles');

      if (alunosFunctionError) {
        console.error('Erro ao chamar função get_all_aluno_profiles:', alunosFunctionError?.message);
        setError('Não foi possível carregar as informações do aluno.');
        setLoading(false);
        return;
      }

      const targetAluno = (allAlunosData as any[]).find(al => al.id === alunoId);

      if (!targetAluno) {
        setError('Aluno não encontrado ou não é um aluno válido.');
        setLoading(false);
        return;
      }
      setAlunoInfo({
          id: targetAluno.id,
          nome_completo: targetAluno.nome_completo,
          email: targetAluno.aluno_email || 'email-nao-disponivel'
      });

      // 3. Buscar a anamnese do aluno
      const { data: anamnese, error: anamneseError } = await supabase
        .from('anamneses')
        .select('*')
        .eq('aluno_id', alunoId)
        .single();

      if (anamneseError && anamneseError.code !== 'PGRST116') { // PGRST116 = No rows found
        console.error('Erro ao buscar anamnese:', anamneseError.message);
        setError('Erro ao carregar a anamnese do aluno.');
      } else if (anamnese) {
        setAnamneseData(anamnese); // Carrega os dados da anamnese
      }
      setLoading(false);
    }

    fetchData();
  }, [router, alunoId]);


  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center text-lime-400 text-2xl">
        Carregando detalhes do aluno...
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
        <Link href={`/professor/alunos`} className="mt-4 bg-lime-400 text-gray-900 py-2 px-6 rounded-full hover:bg-lime-300 transition duration-300">
          Voltar para Lista de Alunos
        </Link>
      </main>
    );
  }

  if (!alunoInfo) {
      return (
        <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-red-500 text-lg p-4">
          <p>Aluno não encontrado ou ID inválido.</p>
          <Link href={`/professor/alunos`} className="mt-4 bg-lime-400 text-gray-900 py-2 px-6 rounded-full hover:bg-lime-300 transition duration-300">
            Voltar para Lista de Alunos
          </Link>
        </main>
      );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-lime-400 mb-6 text-center">
          Detalhes do Aluno
        </h1>
        <h2 className="text-2xl font-bold text-white mb-4 text-center">
            {alunoInfo.nome_completo || alunoInfo.email}
        </h2>
        <p className="text-gray-400 text-center mb-8">Email: {alunoInfo.email}</p>

        <section className="bg-gray-800 p-8 rounded-lg shadow-xl border-t-4 border-lime-400 space-y-6">
          <h3 className="text-3xl font-bold text-lime-400 mb-6 text-center">Anamnese do Aluno</h3>

          {!anamneseData ? (
            <p className="text-gray-400 text-center text-lg">
              Anamnese não preenchida por este aluno ainda.
            </p>
          ) : (
            <div className="space-y-4">
              {/* Campos da Anamnese em modo de leitura */}
              {Object.entries(anamneseData).map(([key, value]) => {
                // Ignora 'id', 'aluno_id', 'created_at' e campos vazios
                if (['id', 'aluno_id', 'created_at', 'role'].includes(key) || !value) {
                  return null;
                }

                // Formata o nome do campo para exibição
                const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());

                return (
                  <div key={key} className="bg-gray-900 p-4 rounded-md">
                    <p className="text-lime-400 font-bold mb-1">{formattedKey}:</p>
                    <p className="text-gray-300">{value}</p>
                  </div>
                );
              })}
            </div>
          )}
           <Link href={`/professor/alunos/${alunoId}/atribuir-treino`} className="block text-center mt-8 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300 text-lg">
            Atribuir Treino
          </Link>
        </section>

      </div>
    </main>
  );
}