// src/app/professor/alunos/[alunoId]/arquivos/page.tsx
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

interface Arquivo {
  id: string;
  nome_arquivo: string;
  url: string;
  aluno_id: string;
  professor_id: string;
  tipo: string | null;
  created_at: string;
}

export default function ArquivosAlunoPage() {
  const router = useRouter();
  const params = useParams();
  const alunoId = params.alunoId as string; // ID do aluno da URL

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [professorId, setProfessorId] = useState<string | null>(null);
  const [alunoNome, setAlunoNome] = useState<string | null>(null);
  const [arquivos, setArquivos] = useState<Arquivo[]>([]);

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

      const userRole = user.app_metadata?.user_role as string || null;
      if (userRole !== 'professor') {
        setError('Acesso negado. Esta página é apenas para professores.');
        setLoading(false);
        return;
      }

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

      // Buscar arquivos do aluno
      const { data: arquivosData, error: arquivosError } = await supabase
        .from('arquivos')
        .select('*')
        .eq('aluno_id', alunoId)
        .order('created_at', { ascending: false });

      if (arquivosError) {
        console.error('Erro ao buscar arquivos:', arquivosError.message);
        setError('Não foi possível carregar os arquivos do aluno.');
      } else {
        setArquivos(arquivosData || []);
      }
      setLoading(false);
    }

    if (alunoId) {
        fetchData();
    }
  }, [alunoId, router]);

  const handleDeleteFile = async (arquivoId: string) => {
    if (!confirm('Tem certeza que deseja excluir este arquivo?')) return;
    alert('Funcionalidade de deletar arquivo será implementada aqui.');
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center text-lime-400 text-2xl">
        Carregando arquivos do aluno...
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
          Arquivos de {alunoNome}
        </h1>

        <div className="flex justify-start items-center mb-8">
          <Link href={`/professor/alunos`} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-full transition duration-300">
            &larr; Voltar para Gerenciar Alunos
          </Link>
        </div>

        <section className="bg-gray-800 p-8 rounded-lg shadow-xl border-t-4 border-lime-400">
          <h2 className="text-2xl font-bold text-white mb-6">Arquivos do Aluno</h2>
          {arquivos.length === 0 ? (
            <p className="text-gray-400 text-center">Este aluno ainda não enviou nenhum arquivo.</p>
          ) : (
            <div className="space-y-4">
              {arquivos.map(arquivo => (
                <div key={arquivo.id} className="bg-gray-900 p-4 rounded-lg flex justify-between items-center">
                  <div>
                    <a href={arquivo.url} target="_blank" rel="noopener noreferrer" className="text-lime-300 font-semibold hover:underline">
                      {arquivo.nome_arquivo}
                    </a>
                    <p className="text-gray-400 text-sm">Tipo: {arquivo.tipo || 'N/A'}</p>
                    <p className="text-gray-500 text-xs">Data de envio: {new Date(arquivo.created_at).toLocaleDateString()}</p>
                  </div>
                  <a href={arquivo.url} download className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm">
                    Baixar
                  </a>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}