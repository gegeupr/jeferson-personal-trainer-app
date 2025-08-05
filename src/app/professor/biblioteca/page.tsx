"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import Link from 'next/link';

interface Exercicio {
  id: string;
  nome: string;
  descricao: string | null;
  link_youtube: string | null;
  professor_id: string;
}

export default function BibliotecaExerciciosPage() {
  const router = useRouter();
  const [professorId, setProfessorId] = useState<string | null>(null);
  const [exercicios, setExercicios] = useState<Exercicio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados para o formulário de novo exercício
  const [novoExercicioNome, setNovoExercicioNome] = useState('');
  const [novoExercicioDescricao, setNovoExercicioDescricao] = useState('');
  const [novoExercicioLinkYoutube, setNovoExercicioLinkYoutube] = useState('');

  // Estados para o modal de edição
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentExercicio, setCurrentExercicio] = useState<Exercicio | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editDescricao, setEditDescricao] = useState('');
  const [editLinkYoutube, setEditLinkYoutube] = useState('');

  useEffect(() => {
    async function checkUserAndFetchExercicios() {
      setLoading(true);
      setError(null);

      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push('/login');
        return;
      }
      setProfessorId(user.id);

      // 1. Verificar se o usuário é professor (lendo do JWT)
      const userRole = user.app_metadata?.user_role as string | null;
      if (userRole !== 'professor') {
        setError('Acesso negado. Esta página é apenas para professores.');
        setLoading(false);
        return;
      }

      // 2. Buscar exercícios do professor logado
      const { data: exerciciosData, error: exerciciosError } = await supabase
        .from('exercicios')
        .select('*')
        .eq('professor_id', user.id)
        .order('nome', { ascending: true });

      if (exerciciosError) {
        console.error('Erro ao buscar exercícios:', exerciciosError.message);
        setError('Não foi possível carregar a biblioteca de exercícios.');
      } else {
        setExercicios(exerciciosData || []);
      }
      setLoading(false);
    }

    checkUserAndFetchExercicios();
  }, [router]);

  const handleAddExercicio = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (!professorId) {
      setError('ID do professor não encontrado. Faça login novamente.');
      setIsSubmitting(false);
      return;
    }

    if (!novoExercicioNome.trim()) {
      setError('O nome do exercício é obrigatório.');
      setIsSubmitting(false);
      return;
    }

    try {
      const { data, error: insertError } = await supabase
        .from('exercicios')
        .insert({
          nome: novoExercicioNome.trim(),
          descricao: novoExercicioDescricao.trim() || null,
          link_youtube: novoExercicioLinkYoutube.trim() || null,
          professor_id: professorId,
        })
        .select()
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          setError('Já existe um exercício com este nome. Por favor, use um nome diferente.');
        } else {
          throw new Error(insertError.message);
        }
      } else {
        setExercicios(prev => [...prev, data]);
        setNovoExercicioNome('');
        setNovoExercicioDescricao('');
        setNovoExercicioLinkYoutube('');
        alert('Exercício adicionado com sucesso!');
      }
    } catch (err: any) {
      console.error('Erro ao adicionar exercício:', err);
      setError(`Erro ao adicionar exercício: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (exercicio: Exercicio) => {
    setCurrentExercicio(exercicio);
    setEditNome(exercicio.nome);
    setEditDescricao(exercicio.descricao || '');
    setEditLinkYoutube(exercicio.link_youtube || '');
    setError(null);
    setShowEditModal(true);
  };

  const handleUpdateExercicio = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (!currentExercicio) return;
    if (!editNome.trim()) {
      setError('O nome do exercício é obrigatório.');
      setIsSubmitting(false);
      return;
    }

    try {
      const { data, error: updateError } = await supabase
        .from('exercicios')
        .update({
          nome: editNome.trim(),
          descricao: editDescricao.trim() || null,
          link_youtube: editLinkYoutube.trim() || null,
        })
        .eq('id', currentExercicio.id)
        .eq('professor_id', professorId)
        .select()
        .single();

      if (updateError) {
        if (updateError.code === '23505') {
          setError('Já existe outro exercício com este nome. Por favor, use um nome diferente.');
        } else {
          throw new Error(updateError.message);
        }
      } else {
        setExercicios(prev => prev.map(ex => ex.id === data.id ? data : ex));
        alert('Exercício atualizado com sucesso!');
        setShowEditModal(false);
        setCurrentExercicio(null);
      }
    } catch (err: any) {
      console.error('Erro ao atualizar exercício:', err);
      setError(`Erro ao atualizar exercício: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExercicio = async (exercicioId: string) => {
    if (!confirm('Tem certeza que deseja deletar este exercício? Isso o removerá de todos os treinos!')) return;
    
    setLoading(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from('exercicios')
        .delete()
        .eq('id', exercicioId)
        .eq('professor_id', professorId);

      if (deleteError) throw deleteError;

      setExercicios(prev => prev.filter(ex => ex.id !== exercicioId));
      alert('Exercício deletado com sucesso!');
    } catch (err: any) {
      console.error('Erro ao deletar exercício:', err.message);
      setError('Erro ao deletar exercício: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center text-lime-400 text-2xl">
        Carregando biblioteca...
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
        <h1 className="text-4xl font-bold text-lime-400 mb-8 text-center">Biblioteca de Exercícios</h1>

        <div className="flex justify-start items-center mb-8">
          <Link href="/dashboard" className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-full transition duration-300">
            &larr; Voltar ao Dashboard
          </Link>
        </div>

        <section className="bg-gray-800 p-8 rounded-lg shadow-xl border-t-4 border-lime-400 mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">Adicionar Novo Exercício</h2>
          {error && !error.includes('Acesso negado') && (
            <p className="text-red-500 text-center mb-4">{error}</p>
          )}
          <form onSubmit={handleAddExercicio} className="space-y-6">
            <div>
              <label htmlFor="nome" className="block text-gray-300 text-sm font-bold mb-2">Nome do Exercício:</label>
              <input
                type="text"
                id="nome"
                value={novoExercicioNome}
                onChange={(e) => setNovoExercicioNome(e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline bg-gray-200"
                placeholder="Ex: Agachamento Livre"
                required
              />
            </div>
            <div>
              <label htmlFor="descricao" className="block text-gray-300 text-sm font-bold mb-2">Descrição (Opcional):</label>
              <textarea
                id="descricao"
                rows={3}
                value={novoExercicioDescricao}
                onChange={(e) => setNovoExercicioDescricao(e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline bg-gray-200 resize-none"
                placeholder="Ex: Mantenha as costas retas, joelhos apontando para fora..."
              ></textarea>
            </div>
            <div>
              <label htmlFor="link_youtube" className="block text-gray-300 text-sm font-bold mb-2">Link do Vídeo (YouTube - Opcional):</label>
              <input
                type="url"
                id="link_youtube"
                value={novoExercicioLinkYoutube}
                onChange={(e) => setNovoExercicioLinkYoutube(e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline bg-gray-200"
                placeholder="Ex: https://www.youtube.com/watch?v=..."
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-lime-400 hover:bg-lime-300 text-gray-900 font-bold py-3 px-8 rounded-full shadow-lg transition duration-300 text-lg w-full"
            >
              {isSubmitting ? 'Adicionando...' : 'Adicionar Exercício'}
            </button>
          </form>
        </section>

        <section className="bg-gray-800 p-8 rounded-lg shadow-xl border-t-4 border-lime-400">
          <h2 className="text-2xl font-bold text-white mb-6">Meus Exercícios</h2>
          {exercicios.length === 0 ? (
            <p className="text-gray-400 text-center">Você ainda não adicionou nenhum exercício.</p>
          ) : (
            <div className="space-y-4">
              {exercicios.map(exercicio => (
                <div key={exercicio.id} className="bg-gray-900 p-6 rounded-lg border border-gray-700">
                  <h3 className="text-xl font-bold text-lime-300 mb-2">{exercicio.nome}</h3>
                  {exercicio.descricao && (
                    <p className="text-gray-400 text-sm mb-2">{exercicio.descricao}</p>
                  )}
                  {exercicio.link_youtube && (
                    <a
                      href={exercicio.link_youtube}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 text-sm inline-flex items-center"
                    >
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                        <path fillRule="evenodd" d="M.05 4.555A2 2 0 012 2.5h16A2 2 0 0119.95 4.555L10 14.555 0.05 4.555zM18 6V4a2 2 0 00-2-2H4a2 2 0 00-2 2v2H.05A2 2 0 010 4.5V15a2 2 0 002 2h16a2 2 0 002-2V4.5A2 2 0 0119.95 4.555L10 14.555 0.05 4.555z" clipRule="evenodd" />
                      </svg>
                      Ver Vídeo
                    </a>
                  )}
                  <div className="mt-4 flex space-x-4">
                    <button
                      onClick={() => openEditModal(exercicio)}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 px-4 rounded-full transition duration-300"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeleteExercicio(exercicio.id)}
                      className="bg-red-600 hover:bg-red-700 text-white text-sm py-2 px-4 rounded-full transition duration-300"
                    >
                      Deletar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {showEditModal && currentExercicio && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-8 rounded-lg shadow-xl border-t-4 border-lime-400 w-full max-w-md">
              <h2 className="text-2xl font-bold text-white mb-6">Editar Exercício</h2>
              {error && !error.includes('Acesso negado') && (
                <p className="text-red-500 text-center mb-4">{error}</p>
              )}
              <form onSubmit={handleUpdateExercicio} className="space-y-6">
                <div>
                  <label htmlFor="editNome" className="block text-gray-300 text-sm font-bold mb-2">Nome do Exercício:</label>
                  <input
                    type="text"
                    id="editNome"
                    value={editNome}
                    onChange={(e) => setEditNome(e.target.value)}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline bg-gray-200"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="editDescricao" className="block text-gray-300 text-sm font-bold mb-2">Descrição (Opcional):</label>
                  <textarea
                    id="editDescricao"
                    rows={3}
                    value={editDescricao}
                    onChange={(e) => setEditDescricao(e.target.value)}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline bg-gray-200 resize-none"
                  ></textarea>
                </div>
                <div>
                  <label htmlFor="editLinkYoutube" className="block text-gray-300 text-sm font-bold mb-2">Link do Vídeo (YouTube - Opcional):</label>
                  <input
                    type="url"
                    id="editLinkYoutube"
                    value={editLinkYoutube}
                    onChange={(e) => setEditLinkYoutube(e.target.value)}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline bg-gray-200"
                  />
                </div>
                <div className="flex space-x-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-lime-400 hover:bg-lime-300 text-gray-900 font-bold py-2 px-4 rounded-full transition duration-300 flex-1"
                  >
                    {isSubmitting ? 'Atualizando...' : 'Atualizar Exercício'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-full transition duration-300 flex-1"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}