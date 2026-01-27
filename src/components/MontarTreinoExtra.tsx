// src/components/MontarTreinoExtra.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase-browser';
import { v4 as uuidv4 } from 'uuid';

// Tipos de dados
interface Exercicio {
  id: string;
  nome: string;
  descricao: string;
  link_youtube: string;
}

interface TreinoExtraExercicio {
  exercicio_id: string;
  exercicio_nome: string;
  ordem: number;
  series: number | null;
  repeticoes: string | null;
  carga: string | null;
  intervalo: string | null;
  observacoes: string | null;
}

interface MontarTreinoExtraProps {
  alunoId: string;
  onSuccess: () => void;
  onError: (message: string) => void;
}

export default function MontarTreinoExtra({ alunoId, onSuccess, onError }: MontarTreinoExtraProps) {
  const [professorId, setProfessorId] = useState<string | null>(null);
  const [biblioteca, setBiblioteca] = useState<Exercicio[]>([]);
  const [treinoNome, setTreinoNome] = useState('');
  const [treinoDescricao, setTreinoDescricao] = useState('');
  const [exerciciosDoTreino, setExerciciosDoTreino] = useState<TreinoExtraExercicio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        onError('Usuário não autenticado.');
        setLoading(false);
        return;
      }
      setProfessorId(user.id);

      const { data, error } = await supabase.from('exercicios').select('*').order('nome', { ascending: true });
      if (error) {
        onError('Erro ao carregar a biblioteca de exercícios.');
        console.error(error);
      } else {
        setBiblioteca(data || []);
      }
      setLoading(false);
    }
    loadData();
  }, [onError]);

  const handleAdicionarExercicio = (exercicio: Exercicio) => {
    const novoExercicio: TreinoExtraExercicio = {
      exercicio_id: exercicio.id,
      exercicio_nome: exercicio.nome,
      ordem: exerciciosDoTreino.length + 1,
      series: null,
      repeticoes: null,
      carga: null,
      intervalo: null,
      observacoes: null,
    };
    setExerciciosDoTreino([...exerciciosDoTreino, novoExercicio]);
  };

  const handleRemoverExercicio = (index: number) => {
    const novosExercicios = exerciciosDoTreino.filter((_, i) => i !== index);
    setExerciciosDoTreino(novosExercicios.map((ex, i) => ({ ...ex, ordem: i + 1 })));
  };

  const handleSalvarTreinoExtra = async () => {
    if (!treinoNome || exerciciosDoTreino.length === 0) {
      onError('O treino extra precisa de um nome e pelo menos um exercício.');
      return;
    }
    if (!professorId) {
      onError('ID do professor não encontrado.');
      return;
    }

    setLoading(true);

    try {
      // 1. Inserir o treino extra na tabela `treinos_extras`
      const { data: treinoExtraData, error: treinoExtraError } = await supabase
        .from('treinos_extras')
        .insert({
          aluno_id: alunoId,
          professor_id: professorId,
          nome: treinoNome,
          descricao: treinoDescricao,
        })
        .select()
        .single();

      if (treinoExtraError || !treinoExtraData) {
        throw treinoExtraError || new Error('Dados do treino extra não retornados.');
      }

      const treinoExtraId = treinoExtraData.id;

      // 2. Preparar os exercícios para inserção em `treinos_extras_exercicios`
      const exerciciosParaInserir = exerciciosDoTreino.map(ex => ({
        treino_extra_id: treinoExtraId,
        exercicio_id: ex.exercicio_id,
        ordem: ex.ordem,
        series: ex.series,
        repeticoes: ex.repeticoes,
        carga: ex.carga,
        intervalo: ex.intervalo,
        observacoes: ex.observacoes,
      }));

      // 3. Inserir os exercícios
      const { error: exerciciosError } = await supabase
        .from('treinos_extras_exercicios')
        .insert(exerciciosParaInserir);

      if (exerciciosError) {
        throw exerciciosError;
      }

      // 4. Sucesso! Limpar o formulário e notificar
      setTreinoNome('');
      setTreinoDescricao('');
      setExerciciosDoTreino([]);
      onSuccess();

    } catch (e: any) {
      console.error('Erro ao salvar treino extra:', e.message);
      onError('Erro ao salvar o treino extra: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center text-gray-400">
        Carregando biblioteca...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Formulário de Treino Extra */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700">
        <h3 className="text-xl font-semibold text-lime-400 mb-4">Novo Treino Extra</h3>
        <input
          type="text"
          placeholder="Nome do Treino Extra"
          value={treinoNome}
          onChange={(e) => setTreinoNome(e.target.value)}
          className="w-full bg-gray-900 text-white p-3 rounded-md mb-4 border border-gray-700 focus:ring-lime-400 focus:border-lime-400"
        />
        <textarea
          placeholder="Descrição (opcional)"
          value={treinoDescricao}
          onChange={(e) => setTreinoDescricao(e.target.value)}
          className="w-full bg-gray-900 text-white p-3 rounded-md mb-4 border border-gray-700 focus:ring-lime-400 focus:border-lime-400"
        />
      </div>

      {/* Lista de Exercícios Adicionados */}
      {exerciciosDoTreino.length > 0 && (
        <div className="bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700">
          <h3 className="text-xl font-semibold text-lime-400 mb-4">Exercícios no Treino</h3>
          <ul className="space-y-4">
            {exerciciosDoTreino.map((ex, index) => (
              <li key={index} className="bg-gray-900 p-4 rounded-md">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-lime-300">{index + 1}. {ex.exercicio_nome}</span>
                  <button onClick={() => handleRemoverExercicio(index)} className="text-red-500 hover:text-red-400">
                    Remover
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <input
                    type="number"
                    placeholder="Séries"
                    value={ex.series || ''}
                    onChange={(e) => {
                      const novosExercicios = [...exerciciosDoTreino];
                      novosExercicios[index].series = e.target.value ? parseInt(e.target.value) : null;
                      setExerciciosDoTreino(novosExercicios);
                    }}
                    className="w-full bg-gray-700 text-white p-2 rounded-md border border-gray-600 focus:ring-lime-400 focus:border-lime-400"
                  />
                  <input
                    type="text"
                    placeholder="Repetições"
                    value={ex.repeticoes || ''}
                    onChange={(e) => {
                      const novosExercicios = [...exerciciosDoTreino];
                      novosExercicios[index].repeticoes = e.target.value;
                      setExerciciosDoTreino(novosExercicios);
                    }}
                    className="w-full bg-gray-700 text-white p-2 rounded-md border border-gray-600 focus:ring-lime-400 focus:border-lime-400"
                  />
                  <input
                    type="text"
                    placeholder="Carga"
                    value={ex.carga || ''}
                    onChange={(e) => {
                      const novosExercicios = [...exerciciosDoTreino];
                      novosExercicios[index].carga = e.target.value;
                      setExerciciosDoTreino(novosExercicios);
                    }}
                    className="w-full bg-gray-700 text-white p-2 rounded-md border border-gray-600 focus:ring-lime-400 focus:border-lime-400"
                  />
                  <input
                    type="text"
                    placeholder="Intervalo"
                    value={ex.intervalo || ''}
                    onChange={(e) => {
                      const novosExercicios = [...exerciciosDoTreino];
                      novosExercicios[index].intervalo = e.target.value;
                      setExerciciosDoTreino(novosExercicios);
                    }}
                    className="w-full bg-gray-700 text-white p-2 rounded-md border border-gray-600 focus:ring-lime-400 focus:border-lime-400"
                  />
                </div>
                <textarea
                  placeholder="Observações"
                  value={ex.observacoes || ''}
                  onChange={(e) => {
                    const novosExercicios = [...exerciciosDoTreino];
                    novosExercicios[index].observacoes = e.target.value;
                    setExerciciosDoTreino(novosExercicios);
                  }}
                  className="w-full bg-gray-700 text-white p-2 rounded-md border border-gray-600 mt-2 focus:ring-lime-400 focus:border-lime-400"
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Botão Salvar Treino Extra */}
      <button
        onClick={handleSalvarTreinoExtra}
        className="w-full bg-lime-500 hover:bg-lime-600 text-gray-900 font-bold py-3 rounded-full shadow-lg transition duration-300"
        disabled={loading}
      >
        {loading ? 'Salvando...' : 'Salvar Treino Extra'}
      </button>

      {/* Lista de Exercícios da Biblioteca */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700">
        <h3 className="text-xl font-semibold text-lime-400 mb-4">Biblioteca de Exercícios</h3>
        <ul className="space-y-2">
          {biblioteca.map((ex) => (
            <li key={ex.id} className="flex justify-between items-center bg-gray-900 p-3 rounded-md">
              <span className="text-white">{ex.nome}</span>
              <button onClick={() => handleAdicionarExercicio(ex)} className="bg-lime-500 text-gray-900 px-3 py-1 rounded-full text-sm hover:bg-lime-400 transition duration-300">
                Adicionar
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}