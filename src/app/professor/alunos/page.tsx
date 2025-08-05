// src/app/professor/alunos/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import Link from 'next/link';

interface AlunoProfile {
  id: string;
  nome_completo: string | null;
  aluno_email: string;
}

export default function GerenciarAlunosPage() {
  const router = useRouter();
  const [professorId, setProfessorId] = useState<string | null>(null);
  const [alunos, setAlunos] = useState<AlunoProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkUserAndFetchAlunos() {
      setLoading(true);
      setError(null);
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push('/login');
        return;
      }
      setProfessorId(user.id);

      // 1. Verificar se o usuário logado é um professor (lendo do JWT)
      const userRole = user.app_metadata?.user_role as string || null;
      if (userRole !== 'professor') {
        setError('Acesso negado. Esta página é apenas para professores.');
        setLoading(false);
        return;
      }

      // 2. Buscar a lista de alunos usando a função RPC (ignora RLS)
      const { data: alunosData, error: alunosError } = await supabase.rpc('get_all_aluno_profiles');

      if (alunosError) {
        console.error('Erro ao buscar alunos via RPC:', alunosError.message);
        setError('Não foi possível carregar a lista de alunos.');
      } else {
        setAlunos(alunosData as AlunoProfile[] || []);
      }
      setLoading(false);
    }

    checkUserAndFetchAlunos();
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center text-lime-400 text-2xl">
        Carregando alunos...
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
        <h1 className="text-4xl font-bold text-lime-400 mb-8 text-center">Gerenciar Alunos</h1>

        {/* Botão Voltar ao Dashboard */}
        <div className="flex justify-start items-center mb-8">
          <Link href="/dashboard" className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-full transition duration-300">
            &larr; Voltar ao Dashboard
          </Link>
        </div>

        {alunos.length === 0 ? (
          <p className="text-center text-gray-400 text-lg">Nenhum aluno cadastrado ainda.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {alunos.map(aluno => (
              <div key={aluno.id} className="bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700">
                <h2 className="text-2xl font-semibold text-lime-300 mb-2">{aluno.nome_completo || 'Aluno Sem Nome'}</h2>
                <p className="text-gray-300 mb-4">{aluno.aluno_email}</p>
                
                <div className="flex flex-wrap gap-2 justify-center">
                  <Link href={`/professor/alunos/${aluno.id}/atribuir-treino`} className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-full text-sm">
                    Treinos
                  </Link>
                  <Link href={`/professor/alunos/${aluno.id}/anamnese-aluno`} className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-full text-sm">
                    Avaliações
                  </Link>
                  <Link href={`/professor/alunos/${aluno.id}/financeiro`} className="bg-yellow-600 hover:bg-yellow-700 text-white py-2 px-4 rounded-full text-sm">
                    Financeiro
                  </Link>
                  <Link href={`/professor/alunos/${aluno.id}/progresso-aluno`} className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-full text-sm">
                    Progresso
                  </Link>
                  {/* CORREÇÃO AQUI: Link para a página de Treinos Extras */}
                  <Link href={`/professor/alunos/${aluno.id}/treinos-extras`} className="bg-orange-600 hover:bg-orange-700 text-white py-2 px-4 rounded-full text-sm">
                    Treinos Extras
                  </Link>
                  {/* CORREÇÃO AQUI: Link para a página de Arquivos */}
                  <Link href={`/professor/alunos/${aluno.id}/arquivos`} className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-full text-sm">
                    Arquivos
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}