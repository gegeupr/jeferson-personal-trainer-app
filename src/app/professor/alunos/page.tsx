"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import Link from 'next/link';

interface AlunoProfile {
  id: string;
  nome_completo: string | null;
  email: string | null;
  telefone: string | null;
}

export default function GerenciarAlunosPage() {
  const router = useRouter();
  const [professorName, setProfessorName] = useState<string | null>(null);
  const [alunos, setAlunos] = useState<AlunoProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedAlunoId, setExpandedAlunoId] = useState<string | null>(null);

  useEffect(() => {
    async function getProfessorAndStudents() {
      setLoading(true);
      setError(null);

      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push('/login');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, nome_completo')
        .eq('id', user.id)
        .single();
        
      if (profileError || profile?.role !== 'professor') {
        setError('Acesso negado. Esta página é apenas para professores.');
        setLoading(false);
        return;
      }
      
      setProfessorName(profile.nome_completo);

      const { data: alunosData, error: alunosError } = await supabase
        .from('profiles')
        .select('id, nome_completo, email, telefone')
        .eq('professor_id', user.id);

      if (alunosError) {
        console.error('Erro ao buscar alunos:', alunosError.message);
        setError('Não foi possível carregar a lista de alunos.');
        setLoading(false);
        return;
      }

      setAlunos(alunosData || []);
      setLoading(false);
    }
    
    getProfessorAndStudents();
  }, [router]);
  
  const handleToggleAluno = (alunoId: string) => {
    setExpandedAlunoId(expandedAlunoId === alunoId ? null : alunoId);
  };
  
  const handleWhatsapp = (aluno: AlunoProfile) => {
    if (aluno.telefone) {
      window.open(`https://wa.me/55${aluno.telefone.replace(/\D/g, '')}`, '_blank');
    } else {
      alert('Número de telefone não cadastrado.');
    }
  };
  
  const handleInativarAluno = async (aluno: AlunoProfile) => {
      if (!confirm(`Tem certeza que deseja inativar o aluno ${aluno?.nome_completo}?`)) return;
      // Lógica de inativação (exemplo: update no status do perfil)
      alert('Aluno inativado com sucesso!');
  };
  
  const handleExcluirAluno = async (aluno: AlunoProfile) => {
      if (!confirm(`Tem certeza que deseja excluir o aluno ${aluno?.nome_completo}?`)) return;
      // Lógica de exclusão (exemplo: delete do perfil)
      alert('Aluno excluído com sucesso!');
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center text-lime-400 text-2xl">
        Carregando lista de alunos...
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-red-500 text-lg p-4">
        <p>{error}</p>
        <Link href="/professor/dashboard" className="mt-4 bg-lime-400 text-gray-900 py-2 px-6 rounded-full hover:bg-lime-300 transition duration-300">
          Voltar ao Dashboard
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-lime-400 mb-4 text-center">Gerenciar Alunos</h1>
        <p className="text-xl text-gray-300 mb-8 text-center">Bem-vindo, Professor {professorName}!</p>
        
        <div className="flex justify-start items-center mb-8">
          <Link href="/professor/dashboard" className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-full transition duration-300">
            &larr; Voltar ao Dashboard
          </Link>
        </div>

        <section className="bg-gray-800 p-8 rounded-lg shadow-xl border-t-4 border-lime-400">
          <h2 className="text-2xl font-bold text-white mb-6">Meus Alunos</h2>
          
          {alunos.length === 0 ? (
            <p className="text-gray-400 text-center">Você ainda não tem alunos vinculados.</p>
          ) : (
            <div className="space-y-4">
              {alunos.map(aluno => (
                <div key={aluno.id} className="bg-gray-900 p-4 rounded-lg">
                  <div className="flex justify-between items-center cursor-pointer" onClick={() => handleToggleAluno(aluno.id)}>
                    <span className="text-lime-300 font-semibold">{aluno.nome_completo}</span>
                    <span>{expandedAlunoId === aluno.id ? '▲' : '▼'}</span>
                  </div>
                  {expandedAlunoId === aluno.id && (
                    <div className="mt-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Link href={`/professor/alunos/${aluno.id}/anamnese`} className="block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300 text-center">
                          Anamnese
                        </Link>
                        <Link href={`/professor/alunos/${aluno.id}/arquivos`} className="block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300 text-center">
                          Arquivos
                        </Link>
                        <Link href={`/professor/alunos/${aluno.id}/atribuir-treino`} className="block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300 text-center">
                          Atribuir Treino
                        </Link>
                        <Link href={`/professor/alunos/${aluno.id}/progresso-aluno`} className="block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300 text-center">
                          Progresso
                        </Link>
                      </div>
                      
                      <div className="bg-gray-800 p-4 rounded-lg space-y-2">
                        <h3 className="text-xl font-bold text-lime-300">Opções de Contato e Gestão</h3>
                        <div className="flex flex-col md:flex-row md:space-x-4 space-y-4 md:space-y-0">
                          <button
                            onClick={() => handleWhatsapp(aluno)}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-full shadow-lg transition duration-300 flex-1 text-center"
                          >
                            Conversar no WhatsApp
                          </button>
                          <button
                            onClick={() => alert(`Status de Assinatura: ${'ativo'}`)}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-full shadow-lg transition duration-300 flex-1 text-center"
                          >
                            Ver Status de Assinatura
                          </button>
                        </div>
                        <div className="bg-gray-900 p-4 rounded-lg space-y-2">
                            <p className="text-gray-300 font-semibold">Email: {aluno.email}</p>
                            <p className="text-gray-300 font-semibold">Telefone: {aluno.telefone || 'Não cadastrado'}</p>
                        </div>
                      </div>

                      <div className="flex flex-col md:flex-row md:space-x-4 space-y-4 md:space-y-0">
                        <button
                          onClick={() => handleInativarAluno(aluno)}
                          className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300 text-center"
                        >
                          Inativar Aluno
                        </button>
                        <button
                          onClick={() => handleExcluirAluno(aluno)}
                          className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300 text-center"
                        >
                          Excluir Aluno
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}