// src/app/professor/alunos/[alunoId]/progresso-aluno/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import Link from 'next/link';

interface ProgressoFoto {
  id: string;
  url: string;
  descricao: string | null;
  tipo: string | null;
  data_foto: string | null;
  public_id: string; // Para deletar no Cloudinary (se fosse permitido ao professor)
}

interface AlunoProfile {
  id: string;
  nome_completo: string | null;
  aluno_email: string;
}

export default function ProgressoAlunoPage() {
  const router = useRouter();
  const params = useParams();
  const alunoId = params.alunoId as string; // ID do aluno da URL

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [professorId, setProfessorId] = useState<string | null>(null);
  const [alunoNome, setAlunoNome] = useState<string | null>(null);
  const [fotos, setFotos] = useState<ProgressoFoto[]>([]);

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

      // 3. Buscar fotos de progresso do aluno
      const { data: fotosData, error: fotosError } = await supabase
        .from('progresso_fotos')
        .select('*')
        .eq('aluno_id', alunoId) // Busca fotos para o aluno específico
        .order('created_at', { ascending: false });

      if (fotosError) {
        console.error('Erro ao buscar fotos:', fotosError.message);
        setError('Não foi possível carregar as fotos de progresso do aluno.');
      } else {
        setFotos(fotosData || []);
      }
      setLoading(false);
    }

    if (alunoId) { // Só busca se o alunoId já estiver disponível
        fetchData();
    }
  }, [alunoId, router]);


  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center text-lime-400 text-2xl">
        Carregando progresso do aluno...
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
          Progresso de {alunoNome}
        </h1>

        {/* Botão Voltar para Gerenciar Alunos */}
        <div className="flex justify-start items-center mb-8">
          <Link href={`/professor/alunos`} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-full transition duration-300">
            &larr; Voltar para Gerenciar Alunos
          </Link>
        </div>

        <section className="bg-gray-800 p-8 rounded-lg shadow-xl border-t-4 border-lime-400">
          <h2 className="text-2xl font-bold text-white mb-6">Fotos de Progresso de {alunoNome}</h2>
          {fotos.length === 0 ? (
            <p className="text-gray-400 text-center">Este aluno ainda não enviou nenhuma foto de progresso.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {fotos.map(foto => (
                <div key={foto.id} className="bg-gray-900 rounded-lg shadow-md overflow-hidden relative group">
                  <img
                    src={foto.url}
                    alt={foto.descricao || 'Foto de Progresso'}
                    className="w-full h-48 object-cover"
                  />
                  <div className="p-4">
                    <p className="text-lime-300 font-semibold mb-1">{foto.descricao || 'Sem descrição'}</p>
                    <p className="text-gray-400 text-sm">Tipo: {foto.tipo || 'N/A'}</p>
                    <p className="text-gray-400 text-sm">Data: {foto.data_foto ? new Date(foto.data_foto).toLocaleDateString() : 'N/A'}</p>
                  </div>
                  {/* Professores geralmente não deletam fotos de progresso dos alunos aqui, mas podem ver. */}
                  {/* Se quiser adicionar botão de delete para professor, deve-se implementar a lógica de RLS e API Route */}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}