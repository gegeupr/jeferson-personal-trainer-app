// src/app/professor/alunos/[alunoId]/financeiro/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import Link from 'next/link';

interface AlunoProfile {
  id: string;
  nome_completo: string | null;
  aluno_email: string;
}

export default function FinanceiroAlunoPage() {
  const router = useRouter();
  const params = useParams();
  const alunoId = params.alunoId as string; // ID do aluno da URL

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [professorId, setProfessorId] = useState<string | null>(null);
  const [alunoNome, setAlunoNome] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.push('/login');
        return;
      }
      setProfessorId(user.id);

      // 1. Verificar se o usuário logado é um professor
      const userRole = user.app_metadata?.user_role as string || null;
      if (userRole !== 'professor') {
        setError('Acesso negado. Esta página é apenas para professores.');
        setLoading(false);
        return;
      }

      // 2. Buscar informações do aluno específico
      const { data: alunosRawData, error: alunosError } = await supabase.rpc('get_all_aluno_profiles');
      if (alunosError) {
        console.error('Erro ao buscar alunos via RPC:', alunosError.message);
        setError('Erro ao carregar informações do aluno.');
        setLoading(false);
        return;
      }
      const alunoProfile = (alunosRawData as AlunoProfile[]).find((a) => a.id === alunoId);
      if (!alunoProfile) {
        setError('Aluno não encontrado.');
        setLoading(false);
        return;
      }
      setAlunoNome(alunoProfile.nome_completo || 'Aluno Desconhecido');

      setLoading(false);
    }

    if (alunoId) {
      fetchData();
    }
  }, [alunoId, router]);


  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center text-lime-400 text-2xl">
        Carregando financeiro do aluno...
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
          Posição Financeira de {alunoNome}
        </h1>

        {/* Botão Voltar ao Dashboard */}
        <div className="flex justify-start items-center mb-8">
          <Link href={`/professor/alunos`} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-full transition duration-300">
            &larr; Voltar para Gerenciar Alunos
          </Link>
        </div>

        <section className="bg-gray-800 p-8 rounded-lg shadow-xl border-t-4 border-lime-400">
          <h2 className="text-2xl font-bold text-white mb-6">Detalhamento Financeiro (Em Breve)</h2>
          <p className="text-gray-400 text-center text-lg">
            Esta seção exibirá o histórico de pagamentos e status da assinatura do aluno.
          </p>
          {/* Aqui você pode adicionar a lógica para buscar e exibir os dados financeiros */}
        </section>
      </div>
    </main>
  );
}