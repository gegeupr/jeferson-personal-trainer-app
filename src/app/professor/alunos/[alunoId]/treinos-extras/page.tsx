// src/app/professor/alunos/[alunoId]/treinos-extras/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import Link from 'next/link';
import MontarTreinoExtra from '@/components/MontarTreinoExtra'; // Importar o componente

interface AlunoProfile {
  id: string;
  nome_completo: string | null;
  aluno_email: string;
}

export default function TreinosExtrasAlunoPage() {
  const router = useRouter();
  const params = useParams();
  const alunoId = params.alunoId as string; // ID do aluno da URL

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alunoNome, setAlunoNome] = useState<string | null>(null);
  const [professorId, setProfessorId] = useState<string | null>(null);

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

      // 2. Buscar informações do aluno específico para exibir o nome
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

  const handleSuccess = () => {
    alert('Treino extra enviado com sucesso!');
    // Opcional: redirecionar ou recarregar a página
  };

  const handleError = (message: string) => {
    setError(message);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center text-lime-400 text-2xl">
        Carregando página...
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

  return (
    <main className="min-h-screen bg-gray-950 text-white py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-lime-400 mb-8 text-center">
          Treinos Extras de {alunoNome}
        </h1>
        <div className="flex justify-start items-center mb-8">
          <Link href={`/professor/alunos`} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-full transition duration-300">
            &larr; Voltar para Gerenciar Alunos
          </Link>
        </div>

        {error && <p className="text-red-500 text-center mb-4">{error}</p>}

        <section>
          {/* O componente MontarTreinoExtra renderiza o formulário de montagem */}
          <MontarTreinoExtra
            alunoId={alunoId}
            onSuccess={handleSuccess}
            onError={handleError}
          />
        </section>
      </div>
    </main>
  );
}