// src/app/professor/alunos/[alunoId]/atribuir-treino/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import Link from 'next/link';

interface PlanoTreino {
  id: string;
  nome: string;
  // Apenas as propriedades que precisamos buscar para exibir e usar na seleção
}

interface AlunoProfile {
  id: string;
  nome_completo: string | null;
  aluno_email: string;
}

export default function AtribuirTreinoPage() {
  const router = useRouter();
  const params = useParams();
  const alunoId = params.alunoId as string; // Captura o alunoId da URL

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alunoNome, setAlunoNome] = useState<string | null>(null);
  const [professorId, setProfessorId] = useState<string | null>(null);
  const [planosDisponiveis, setPlanosDisponiveis] = useState<PlanoTreino[]>([]);
  const [planoSelecionadoId, setPlanoSelecionadoId] = useState<string>(''); // Novo estado para o plano selecionado
  const [isSubmitting, setIsSubmitting] = useState(false);


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

      // 3. Buscar Planos de Treino criados por ESTE professor
      const { data: planosData, error: planosError } = await supabase
        .from('treinos')
        .select(`id, nome`) // Apenas ID e nome são necessários para o dropdown
        .eq('professor_id', user.id)
        .order('created_at', { ascending: false });

      if (planosError) {
        console.error('Erro ao buscar planos de treino:', planosError.message);
        setError('Não foi possível carregar os planos de treino disponíveis.');
      } else {
        setPlanosDisponiveis(planosData as PlanoTreino[] || []);
      }

      setLoading(false);
    }
    fetchData();
  }, [alunoId, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (!planoSelecionadoId) {
      setError('Por favor, selecione um Plano de Treino para atribuir.');
      setIsSubmitting(false);
      return;
    }

    if (!alunoId || !professorId) {
      setError('Erro de autenticação ou IDs ausentes. Tente recarregar.');
      setIsSubmitting(false);
      return;
    }

    try {
      // Chamada à função RPC para atribuir o plano ao aluno
      const { error: rpcError } = await supabase.rpc('atribuir_treino', {
        p_plano_id: planoSelecionadoId,
        p_aluno_id: alunoId,
      });

      if (rpcError) {
        if (rpcError.code === '23505') { // Código para UNIQUE violation
          setError('Este plano já está atribuído a este aluno.');
        } else if (rpcError.message.includes('Acesso negado')) {
          setError('Acesso negado: Você não tem permissão para atribuir este treino.');
        } else {
          setError(`Erro ao atribuir treino: ${rpcError.message}`);
        }
        // Não lançar erro aqui para o finally ser executado
      } else {
        alert('Plano de treino atribuído com sucesso!');
        // Opcional: redirecionar ou mostrar mensagem de sucesso
        router.push(`/professor/alunos`); // Volta para a página de gerenciamento de alunos
      }
    } catch (err: any) {
      console.error('Erro ao atribuir treino:', err);
      // O erro já foi setado acima, se for um rpcError. Para outros erros inesperados.
      if (!error) { 
        setError(`Erro inesperado ao atribuir treino: ${err.message || 'Verifique o console para mais detalhes.'}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center text-lime-400 text-2xl">
        Carregando...
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
      <div className="max-w-xl mx-auto bg-gray-800 p-8 rounded-lg shadow-xl border-t-4 border-lime-400">
        <h1 className="text-4xl font-bold text-lime-400 mb-6 text-center">
          Atribuir Treino para {alunoNome}
        </h1>
        {/* Botão Voltar para Gerenciar Alunos */}
        <div className="flex justify-start items-center mb-8">
          <Link href={`/professor/alunos`} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-full transition duration-300">
            &larr; Voltar para Gerenciar Alunos
          </Link>
        </div>

        {error && !error.includes('Acesso negado') && (
            <p className="text-red-500 text-center mb-4">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="planoTreino" className="block text-gray-300 text-sm font-bold mb-2">
              Selecionar Plano de Treino:
            </label>
            <select
              id="planoTreino"
              name="plano_treino_id"
              value={planoSelecionadoId} // Usa o novo estado
              onChange={(e) => setPlanoSelecionadoId(e.target.value)} // Atualiza o novo estado
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline bg-gray-200"
              required
            >
              <option value="">Selecione um Plano</option>
              {planosDisponiveis.map(plano => (
                <option key={plano.id} value={plano.id}>{plano.nome}</option>
              ))}
            </select>
          </div>

          {/* Removido o Dropdown de Seleção de Rotina Diária, pois a atribuição é do Plano Geral */}
          {/*
          {planoSelecionadoId && rotinasDoPlanoSelecionado.length > 0 && (
            <div>
              <label htmlFor="rotinaDiaria" className="block text-gray-300 text-sm font-bold mb-2">
                Selecionar Rotina Diária:
              </label>
              <select
                id="rotinaDiaria"
                name="rotina_id"
                value={form.rotina_id}
                onChange={handleFormChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline bg-gray-200"
                required
              >
                <option value="">Selecione uma Rotina</option>
                {rotinasDoPlanoSelecionado.map(rotina => (
                  <option key={rotina.id} value={rotina.id}>{rotina.nome} ({rotina.treino_exercicios.length} exercícios)</option>
                ))}
              </select>
            </div>
          )}
          */}

          <button
            type="submit"
            className="bg-lime-600 hover:bg-lime-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300 text-lg w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Atribuindo Plano...' : 'Atribuir Plano'}
          </button>
        </form>
      </div>
    </main>
  );
}