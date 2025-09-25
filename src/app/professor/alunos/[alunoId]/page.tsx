"use client";

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import Link from 'next/link';

interface AlunoProfile {
  id: string;
  nome_completo: string | null;
  email: string | null;
  telefone: string | null;
}

export default function AlunoProfessorDashboardPage() {
  const router = useRouter();
  const params = useParams();
  const alunoId = params.alunoId as string;

  const [alunoProfile, setAlunoProfile] = useState<AlunoProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusAssinatura, setStatusAssinatura] = useState<'ativo' | 'vencido' | 'inativo' | null>(null);

  useEffect(() => {
    async function fetchAlunoProfile() {
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
        .select('id, nome_completo, email, telefone')
        .eq('id', alunoId)
        .single();
      
      if (alunoError || !alunoData) {
          setError('Aluno não encontrado.');
          setLoading(false);
          return;
      }
      
      const { data: assinaturaData, error: assinaturaError } = await supabase
        .from('assinaturas')
        .select('status')
        .eq('aluno_id', alunoId)
        .order('data_fim', { ascending: false })
        .limit(1)
        .single();
        
      let statusAssinaturaFinal = 'inativo';
      if (assinaturaData) {
          statusAssinaturaFinal = assinaturaData.status;
      }
      
      setStatusAssinatura(statusAssinaturaFinal as 'ativo' | 'vencido' | 'inativo' | null);
      setAlunoProfile(alunoData);
      setLoading(false);
    }
    fetchAlunoProfile();
  }, [router, alunoId]);
  
  const handleWhatsapp = () => {
    if (alunoProfile?.telefone) {
      window.open(`https://wa.me/55${alunoProfile.telefone.replace(/\D/g, '')}`, '_blank');
    } else {
      alert('Número de telefone não cadastrado.');
    }
  };
  
  const handleInativarAluno = async () => {
      if (!confirm(`Tem certeza que deseja inativar o aluno ${alunoProfile?.nome_completo}?`)) return;
      // Lógica de inativação (exemplo: update no status do perfil)
      alert('Aluno inativado com sucesso!');
  };
  
  const handleExcluirAluno = async () => {
      if (!confirm(`Tem certeza que deseja excluir o aluno ${alunoProfile?.nome_completo}?`)) return;
      // Lógica de exclusão (exemplo: delete do perfil)
      alert('Aluno excluído com sucesso!');
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center text-lime-400 text-2xl">
        Carregando perfil do aluno...
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-red-500 text-lg p-4">
        <p>{error}</p>
        <Link href="/professor/alunos" className="mt-4 bg-lime-400 text-gray-900 py-2 px-6 rounded-full hover:bg-lime-300 transition duration-300">
          Voltar para Gerenciar Alunos
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-lime-400 mb-4 text-center">
          Gerenciamento de {alunoProfile?.nome_completo || 'Aluno'}
        </h1>
        <div className="flex justify-start items-center mb-8">
          <Link href="/professor/alunos" className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-full transition duration-300">
            &larr; Voltar
          </Link>
        </div>
        <section className="bg-gray-800 p-8 rounded-lg shadow-xl border-t-4 border-lime-400">
          <h2 className="text-2xl font-bold text-white mb-6">Opções do Aluno</h2>
          <div className="space-y-4">
            <button
              onClick={handleWhatsapp}
              className="block bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300 w-full"
            >
              Conversar no WhatsApp
            </button>
            <div className="bg-gray-900 p-4 rounded-lg flex justify-between items-center text-sm">
                <span className="text-gray-300">Status de Assinatura:</span>
                <span className="font-semibold text-lime-400">{statusAssinatura || 'N/A'}</span>
            </div>
            <div className="bg-gray-900 p-4 rounded-lg text-sm space-y-2">
                <p className="text-gray-300">Informações de Login:</p>
                <p className="text-gray-300 font-semibold">Email: {alunoProfile?.email}</p>
                <p className="text-gray-500">A senha não pode ser exibida por motivos de segurança.</p>
            </div>
            
            <Link href={`/professor/alunos/${alunoId}/anamnese`} className="block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300 text-center">
              Ver Anamnese
            </Link>
            <Link href={`/professor/alunos/${alunoId}/arquivos`} className="block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300 text-center">
              Ver Arquivos
            </Link>
            <Link href={`/professor/alunos/${alunoId}/atribuir-treino`} className="block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300 text-center">
              Atribuir Treino
            </Link>
            <Link href={`/professor/alunos/${alunoId}/progresso`} className="block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300 text-center">
              Ver Progresso
            </Link>
            
            <button
              onClick={handleInativarAluno}
              className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300 text-center"
            >
              Inativar Aluno
            </button>
            <button
              onClick={handleExcluirAluno}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300 text-center"
            >
              Excluir Aluno
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}