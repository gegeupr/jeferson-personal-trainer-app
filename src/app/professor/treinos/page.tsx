"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import Link from 'next/link';

// --- Interfaces de Dados ---
interface Exercicio {
  id: string;
  nome: string;
  descricao: string | null;
  link_youtube: string | null;
  professor_id: string;
}

interface TreinoExercicioData {
  rotina_id: string;
  exercicio_id: string;
  ordem: number;
  series: number | null;
  repeticoes: string | null;
  carga: string | null;
  intervalo: string | null;
  observacoes: string | null;
}

interface TreinoExercicioDisplay extends TreinoExercicioData {
  id: string;
  nomeExercicio: string;
}

interface RotinaDiaria {
  id: string;
  plano_id: string;
  nome: string;
  descricao: string | null;
  created_at: string;
  treino_exercicios: TreinoExercicioData[];
}

interface PlanoTreino {
  id: string;
  nome: string;
  descricao: string | null;
  aluno_id: string;
  professor_id: string;
  tipo_treino: string | null;
  objetivo: string | null;
  dificuldade: string | null;
  orientacao_professor: string | null;
  created_at: string;
  aluno_nome: string | null;
  rotinas_diarias: RotinaDiaria[];
}

interface Aluno {
  id: string;
  nome_completo: string | null;
  email: string;
}

// --- Componente Principal ProfessorTreinosPage ---
export default function ProfessorTreinosPage() {
  const router = useRouter();
  
  // Estados de Carregamento e Erro
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Dados Globais
  const [professorId, setProfessorId] = useState<string | null>(null);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [exerciciosBiblioteca, setExerciciosBiblioteca] = useState<Exercicio[]>([]);
  const [planosTreino, setPlanosTreino] = useState<PlanoTreino[]>([]);

  // Estados dos Modais
  const [showCreatePlanoModal, setShowCreatePlanoModal] = useState(false);
  const [showEditPlanoModal, setShowEditPlanoModal] = useState(false);
  const [showCreateRotinaModal, setShowCreateRotinaModal] = useState(false);
  const [showEditRotinaModal, setShowEditRotinaModal] = useState(false);
  
  // Estados para dados dos modais
  const [currentPlano, setCurrentPlano] = useState<PlanoTreino | null>(null);
  const [currentRotina, setCurrentRotina] = useState<RotinaDiaria | null>(null);
  const [planoFormData, setPlanoFormData] = useState({
    nome: '',
    descricao: '',
    aluno_id: '',
    tipo_treino: '',
    objetivo: '',
    dificuldade: '',
    orientacao_professor: '',
  });
  const [rotinaFormData, setRotinaFormData] = useState({
    nome: '',
    descricao: '',
  });
  const [exerciciosNaRotinaModal, setExerciciosNaRotinaModal] = useState<TreinoExercicioDisplay[]>([]);

  // --- Efeitos e Busca de Dados ---
  useEffect(() => {
    async function checkUserAndFetchData() {
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
        router.push('/dashboard');
        return;
      }
      setProfessorId(user.id);
      await fetchData(user.id);
    }
    checkUserAndFetchData();
  }, [router]);

  async function fetchData(pId: string) {
    setLoading(true);
    setError(null);
    try {
      const { data: alunosData, error: alunosError } = await supabase.rpc('get_all_aluno_profiles');
      if (alunosError) throw alunosError;
      setAlunos(alunosData as Aluno[] || []);

      const { data: exerciciosData, error: exerciciosError } = await supabase
        .from('exercicios')
        .select('id, nome, descricao, link_youtube, professor_id')
        .eq('professor_id', pId);
      if (exerciciosError) throw exerciciosError;
      setExerciciosBiblioteca(exerciciosData || []);

      const { data: planosTreinoRawData, error: planosTreinoError } = await supabase
        .from('treinos')
        .select(`
          id,
          nome,
          descricao,
          aluno_id,
          professor_id,
          tipo_treino,
          objetivo,
          dificuldade,
          orientacao_professor,
          created_at,
          aluno_profile:aluno_id(nome_completo),
          rotinas_diarias(
            id,
            nome,
            descricao,
            created_at,
            treino_exercicios(exercicio_id, ordem, series, repeticoes, carga, intervalo, observacoes)
          )
        `)
        .eq('professor_id', pId)
        .order('created_at', { ascending: false });

      if (planosTreinoError) throw planosTreinoError;

      const formattedPlanosTreino: PlanoTreino[] = planosTreinoRawData.map((plano: any) => ({
        ...plano,
        aluno_nome: plano.aluno_profile?.[0]?.nome_completo || 'Aluno Desconhecido',
        rotinas_diarias: (plano.rotinas_diarias || []).map((rotina: any) => ({
          ...rotina,
          treino_exercicios: rotina.treino_exercicios || []
        }))
      }));
      setPlanosTreino(formattedPlanosTreino);

    } catch (err: any) {
      console.error('Erro ao buscar dados:', err.message);
      setError('Erro ao carregar dados: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // --- Funções de Manipulação de Formulário e Modal ---
  const handlePlanoFormInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setPlanoFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleRotinaFormInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setRotinaFormData(prev => ({ ...prev, [name]: value }));
  };

  // --- Manipulação de Modais de Plano ---
  const handleOpenCreatePlanoModal = () => {
    setPlanoFormData({ nome: '', descricao: '', aluno_id: '', tipo_treino: '', objetivo: '', dificuldade: '', orientacao_professor: '' });
    setError(null);
    setShowCreatePlanoModal(true);
  };

  const handleCloseCreatePlanoModal = () => {
    setShowCreatePlanoModal(false);
    setError(null);
    setPlanoFormData({ nome: '', descricao: '', aluno_id: '', tipo_treino: '', objetivo: '', dificuldade: '', orientacao_professor: '' });
  };

  const handleCreatePlano = async () => {
    if (!planoFormData.nome.trim() || !planoFormData.aluno_id || !planoFormData.tipo_treino || !planoFormData.objetivo || !planoFormData.dificuldade) {
      setError('Por favor, preencha todos os campos obrigatórios do Plano (Nome, Aluno, Tipo, Objetivo, Dificuldade).');
      return;
    }
    setLoading(true);
    setIsSubmitting(true);
    setError(null);
    try {
      const { data: novoPlano, error: planoError } = await supabase
        .from('treinos')
        .insert({
          nome: planoFormData.nome,
          descricao: planoFormData.descricao || null,
          aluno_id: planoFormData.aluno_id,
          professor_id: professorId,
          tipo_treino: planoFormData.tipo_treino,
          objetivo: planoFormData.objetivo,
          dificuldade: planoFormData.dificuldade,
          orientacao_professor: planoFormData.orientacao_professor || null,
        })
        .select()
        .single();

      if (planoError) throw planoError;

      alert('Plano de treino criado com sucesso! Agora adicione as rotinas diárias.');
      handleCloseCreatePlanoModal();
      fetchData(professorId!);
    } catch (err: any) {
      console.error('Erro ao criar plano:', err.message);
      setError('Erro ao criar plano: ' + err.message);
    } finally {
      setLoading(false);
      setIsSubmitting(false);
    }
  };

  const handleOpenEditPlanoModal = (plano: PlanoTreino) => {
    setCurrentPlano(plano);
    setPlanoFormData({
      nome: plano.nome,
      descricao: plano.descricao || '',
      aluno_id: plano.aluno_id,
      tipo_treino: plano.tipo_treino || '',
      objetivo: plano.objetivo || '',
      dificuldade: plano.dificuldade || '',
      orientacao_professor: plano.orientacao_professor || '',
    });
    setError(null);
    setShowEditPlanoModal(true);
  };

  const handleCloseEditPlanoModal = () => { 
    setShowEditPlanoModal(false);
    setError(null);
    setCurrentPlano(null);
    setPlanoFormData({ nome: '', descricao: '', aluno_id: '', tipo_treino: '', objetivo: '', dificuldade: '', orientacao_professor: '' });
  };

  const handleUpdatePlano = async () => {
    if (!currentPlano || !planoFormData.nome.trim() || !planoFormData.aluno_id || 
        !planoFormData.tipo_treino || !planoFormData.objetivo || !planoFormData.dificuldade) {
      setError('Por favor, preencha todos os campos obrigatórios do Plano (Nome, Aluno, Tipo, Objetivo, Dificuldade).');
      return;
    }
    setLoading(true);
    setIsSubmitting(true);
    setError(null);
    try {
      const { error: planoError } = await supabase
        .from('treinos')
        .update({
          nome: planoFormData.nome,
          descricao: planoFormData.descricao || null,
          aluno_id: planoFormData.aluno_id,
          tipo_treino: planoFormData.tipo_treino,
          objetivo: planoFormData.objetivo,
          dificuldade: planoFormData.dificuldade,
          orientacao_professor: planoFormData.orientacao_professor || null,
        })
        .eq('id', currentPlano.id);

      if (planoError) throw planoError;

      alert('Plano de treino atualizado com sucesso!');
      handleCloseEditPlanoModal();
      fetchData(professorId!);
    } catch (err: any) {
      console.error('Erro ao atualizar plano:', err.message);
      setError('Erro ao atualizar plano: ' + err.message);
    } finally {
      setLoading(false);
      setIsSubmitting(false);
    }
  };

  const handleDeletePlano = async (planoId: string) => {
    if (!confirm('Tem certeza que deseja deletar este Plano de Treino e todas as suas rotinas diárias e exercícios associados?')) return;
    setLoading(true);
    setError(null);
    try {
      const { error: deleteError } = await supabase
        .from('treinos')
        .delete()
        .eq('id', planoId);
      if (deleteError) throw deleteError;
      
      alert('Plano de treino deletado com sucesso!');
      fetchData(professorId!);
    } catch (err: any) {
      console.error('Erro ao deletar plano:', err.message);
      setError('Erro ao deletar plano: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Funções de Manipulação de Rotinas Diárias ---
  const handleOpenCreateRotinaModal = (plano: PlanoTreino) => {
    setCurrentPlano(plano);
    setRotinaFormData({ nome: '', descricao: '' });
    setExerciciosNaRotinaModal([]);
    setError(null);
    setShowCreateRotinaModal(true);
  };

  const handleCloseCreateRotinaModal = () => {
    setShowCreateRotinaModal(false);
    setError(null);
    setCurrentPlano(null);
    setRotinaFormData({ nome: '', descricao: '' });
    setExerciciosNaRotinaModal([]);
  };

  const handleCreateRotina = async () => {
    if (!currentPlano || !rotinaFormData.nome.trim() || exerciciosNaRotinaModal.length === 0) {
      setError('Por favor, preencha o Nome da Rotina e adicione pelo menos um exercício.');
      return;
    }
    setLoading(true);
    setIsSubmitting(true);
    setError(null);

    try {
      const { data: novaRotina, error: rotinaError } = await supabase
        .from('rotinas_diarias')
        .insert({
          plano_id: currentPlano.id,
          nome: rotinaFormData.nome,
          descricao: rotinaFormData.descricao || null,
        })
        .select()
        .single();

      if (rotinaError) throw rotinaError;

      const exerciciosRotinaToInsert = exerciciosNaRotinaModal.map((ex, index) => ({
        rotina_id: novaRotina.id,
        exercicio_id: ex.exercicio_id,
        ordem: index + 1,
        series: ex.series,
        repeticoes: ex.repeticoes,
        carga: ex.carga,
        intervalo: ex.intervalo,
        observacoes: ex.observacoes,
      }));

      const { error: insertExerciciosError } = await supabase
        .from('treino_exercicios')
        .insert(exerciciosRotinaToInsert);

      if (insertExerciciosError) throw insertExerciciosError;

      alert(`Rotina "${novaRotina.nome}" criada com sucesso para o plano "${currentPlano.nome}"!`);
      handleCloseCreateRotinaModal();
      fetchData(professorId!);
    } catch (err: any) {
      console.error('Erro ao criar rotina:', err.message);
      setError('Erro ao criar rotina: ' + err.message);
    } finally {
      setLoading(false);
      setIsSubmitting(false);
    }
  };

  const addExercicioToRotinaModal = (exercicio: Exercicio) => {
    setExerciciosNaRotinaModal(prev => {
      if (prev.find(ex => ex.id === exercicio.id)) {
        setError('Este exercício já foi adicionado a esta rotina.');
        return prev;
      }
      setError(null);
      return [...prev, { 
        id: exercicio.id, 
        nomeExercicio: exercicio.nome,
        exercicio_id: exercicio.id, 
        rotina_id: '', // Adicionado para satisfazer a interface
        ordem: prev.length + 1,
        series: null,
        repeticoes: '',
        carga: '',
        intervalo: '',
        observacoes: '',
      }];
    });
  };

  const updateExercicioNaRotinaModal = (exercicioId: string, field: keyof TreinoExercicioDisplay, value: string | number | null) => {
    setExerciciosNaRotinaModal(prev =>
      prev.map(ex =>
        ex.id === exercicioId ? { ...ex, [field]: value } : ex
      )
    );
  };

  const removeExercicioNaRotinaModal = (exercicioId: string) => {
    setExerciciosNaRotinaModal(prev => prev.filter(ex => ex.id !== exercicioId));
  };

  // --- Renderização do Componente ---
  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center text-lime-400 text-2xl">
        Carregando treinos...
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
        <h1 className="text-4xl font-bold text-lime-400 mb-8 text-center">Gerenciar Planos de Treino</h1>

        <div className="flex justify-between items-center mb-8">
          <Link href="/dashboard" className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-full transition duration-300">
            &larr; Voltar ao Dashboard
          </Link>
          <button
            onClick={handleOpenCreatePlanoModal}
            className="bg-lime-600 hover:bg-lime-700 text-white font-bold py-2 px-6 rounded-full shadow-lg transition duration-300"
          >
            Criar Novo Plano
          </button>
        </div>

        {planosTreino.length === 0 ? (
          <p className="text-center text-gray-400 text-lg">Nenhum plano de treino cadastrado ainda.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {planosTreino.map(plano => (
              <div key={plano.id} className="bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700">
                <h2 className="text-2xl font-semibold text-lime-300 mb-2">{plano.nome}</h2>
                <p className="text-gray-300 mb-1">
                  <span className="font-medium text-lime-200">Aluno:</span> {plano.aluno_nome}
                </p>
                <p className="text-gray-300 mb-1">
                  <span className="font-medium text-lime-200">Tipo:</span> {plano.tipo_treino || 'N/A'}
                </p>
                <p className="text-gray-300 mb-1">
                  <span className="font-medium text-lime-200">Objetivo:</span> {plano.objetivo || 'N/A'}
                </p>
                <p className="text-gray-300 mb-1">
                  <span className="font-medium text-lime-200">Dificuldade:</span> {plano.dificuldade || 'N/A'}
                </p>
                <p className="text-gray-300 mb-4">
                  <span className="font-medium text-lime-200">Orientação:</span> {plano.orientacao_professor || 'N/A'}
                </p>
                <p className="text-gray-400 text-sm mb-4">Criado em: {new Date(plano.created_at).toLocaleDateString()}</p>
                
                <h3 className="text-xl font-semibold text-lime-300 mb-2">Rotinas Diárias:</h3>
                {plano.rotinas_diarias && plano.rotinas_diarias.length > 0 ? (
                  <ul className="list-disc list-inside text-gray-300 mb-4">
                    {plano.rotinas_diarias.map((rotina, index) => (
                      <li key={rotina.id || index}>
                        {rotina.nome} ({rotina.treino_exercicios.length} exercícios)
                        <button 
                          onClick={() => alert(`Ver/Editar Rotina: ${rotina.nome}`)}
                          className="ml-2 text-blue-400 hover:underline text-sm"
                          type="button"
                        >
                          Ver Detalhes
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-400">Nenhuma rotina diária adicionada a este plano.</p>
                )}

                <div className="flex justify-end space-x-2 mt-4">
                  <button
                    onClick={() => handleOpenCreateRotinaModal(plano)}
                    className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-full transition duration-300"
                  >
                    + Rotina
                  </button>
                  <button
                    onClick={() => handleOpenEditPlanoModal(plano)}
                    className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-full transition duration-300"
                  >
                    Editar Plano
                  </button>
                  <button
                    onClick={() => handleDeletePlano(plano.id)}
                    className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-full transition duration-300"
                  >
                    Deletar Plano
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal de Criação de Plano */}
        {showCreatePlanoModal && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
              <h2 className="text-3xl font-bold text-lime-400 mb-6 text-center">Criar Novo Plano de Treino</h2>
              {error && <p className="text-red-500 text-center mb-4">{error}</p>}
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor="create-planoNome" className="block text-gray-300 text-sm font-bold mb-2">Nome do Plano:</label>
                  <input
                    type="text"
                    id="create-planoNome"
                    name="nome"
                    value={planoFormData.nome}
                    onChange={handlePlanoFormInputChange}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline bg-gray-200"
                    placeholder="Ex: Plano de Força A"
                  />
                </div>
                <div>
                  <label htmlFor="create-alunoSelect" className="block text-gray-300 text-sm font-bold mb-2">Atribuir ao Aluno:</label>
                  <select
                    id="create-alunoSelect"
                    name="aluno_id"
                    value={planoFormData.aluno_id}
                    onChange={handlePlanoFormInputChange}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline bg-gray-200"
                  >
                    <option value="">Selecione um Aluno</option>
                    {alunos.map(aluno => (
                      <option key={aluno.id} value={aluno.id}>{aluno.nome_completo} ({aluno.email})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="create-tipoTreino" className="block text-gray-300 text-sm font-bold mb-2">Tipo de Treino:</label>
                  <select
                    id="create-tipoTreino"
                    name="tipo_treino"
                    value={planoFormData.tipo_treino}
                    onChange={handlePlanoFormInputChange}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline bg-gray-200"
                  >
                    <option value="">Selecione o Tipo</option>
                    <option value="Dias da Semana">Dias da Semana (Seg, Ter, Qua...)</option>
                    <option value="Numerico">Numérico (Dia 1, Dia 2, Dia 3...)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="create-objetivo" className="block text-gray-300 text-sm font-bold mb-2">Objetivo:</label>
                  <select
                    id="create-objetivo"
                    name="objetivo"
                    value={planoFormData.objetivo}
                    onChange={handlePlanoFormInputChange}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline bg-gray-200"
                  >
                    <option value="">Selecione o Objetivo</option>
                    <option value="Hipertrofia">Hipertrofia</option>
                    <option value="Reducao de Gordura">Redução de Gordura</option>
                    <option value="Definicao Muscular">Definição Muscular</option>
                    <option value="Condicionamento Fisico">Condicionamento Físico</option>
                    <option value="Qualidade de Vida">Qualidade de Vida</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="create-dificuldade" className="block text-gray-300 text-sm font-bold mb-2">Dificuldade:</label>
                  <select
                    id="create-dificuldade"
                    name="dificuldade"
                    value={planoFormData.dificuldade}
                    onChange={handlePlanoFormInputChange}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline bg-gray-200"
                  >
                    <option value="">Selecione a Dificuldade</option>
                    <option value="Adaptacao">Adaptação</option>
                    <option value="Iniciante">Iniciante</option>
                    <option value="Intermediario">Intermediário</option>
                    <option value="Avancado">Avançado</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="create-orientacaoProfessor" className="block text-gray-300 text-sm font-bold mb-2">Orientações do Professor:</label>
                  <textarea
                    id="create-orientacaoProfessor"
                    name="orientacao_professor"
                    value={planoFormData.orientacao_professor}
                    onChange={handlePlanoFormInputChange}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline bg-gray-200 h-24 resize-none"
                    placeholder="Ex: Aquecimento: 5 min de cardio. Fazer os exercícios com boa forma..."
                  ></textarea>
                </div>
              </div>

              <div className="flex justify-end space-x-4 mt-6">
                <button
                  type="button"
                  onClick={handleCloseCreatePlanoModal}
                  className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-full transition duration-300"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreatePlano}
                  className="bg-lime-600 hover:bg-lime-700 text-white font-bold py-2 px-6 rounded-full shadow-lg transition duration-300"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Criando Plano...' : 'Salvar Plano'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Edição de Plano */}
        {showEditPlanoModal && currentPlano && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
              <h2 className="text-3xl font-bold text-lime-400 mb-6 text-center">Editar Plano de Treino</h2>
              {error && <p className="text-red-500 text-center mb-4">{error}</p>}
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor="edit-planoNome" className="block text-gray-300 text-sm font-bold mb-2">Nome do Plano:</label>
                  <input
                    type="text"
                    id="edit-planoNome"
                    name="nome"
                    value={planoFormData.nome}
                    onChange={handlePlanoFormInputChange}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline bg-gray-200"
                    placeholder="Ex: Treino de Força A"
                  />
                </div>
                <div>
                  <label htmlFor="edit-alunoSelect" className="block text-gray-300 text-sm font-bold mb-2">Atribuir ao Aluno:</label>
                  <select
                    id="edit-alunoSelect"
                    name="aluno_id"
                    value={planoFormData.aluno_id}
                    onChange={handlePlanoFormInputChange}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline bg-gray-200"
                  >
                    <option value="">Selecione um Aluno</option>
                    {alunos.map(aluno => (
                      <option key={aluno.id} value={aluno.id}>{aluno.nome_completo} ({aluno.email})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-tipoTreino" className="block text-gray-300 text-sm font-bold mb-2">Tipo de Treino:</label>
                  <select
                    id="edit-tipoTreino"
                    name="tipo_treino"
                    value={planoFormData.tipo_treino}
                    onChange={handlePlanoFormInputChange}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline bg-gray-200"
                  >
                    <option value="">Selecione o Tipo</option>
                    <option value="Dias da Semana">Dias da Semana (Seg, Ter, Qua...)</option>
                    <option value="Numerico">Numérico (Dia 1, Dia 2, Dia 3...)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-objetivo" className="block text-gray-300 text-sm font-bold mb-2">Objetivo:</label>
                  <select
                    id="edit-objetivo"
                    name="objetivo"
                    value={planoFormData.objetivo}
                    onChange={handlePlanoFormInputChange}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline bg-gray-200"
                  >
                    <option value="">Selecione o Objetivo</option>
                    <option value="Hipertrofia">Hipertrofia</option>
                    <option value="Reducao de Gordura">Redução de Gordura</option>
                    <option value="Definicao Muscular">Definição Muscular</option>
                    <option value="Condicionamento Fisico">Condicionamento Físico</option>
                    <option value="Qualidade de Vida">Qualidade de Vida</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-dificuldade" className="block text-gray-300 text-sm font-bold mb-2">Dificuldade:</label>
                  <select
                    id="edit-dificuldade"
                    name="dificuldade"
                    value={planoFormData.dificuldade}
                    onChange={handlePlanoFormInputChange}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline bg-gray-200"
                  >
                    <option value="">Selecione a Dificuldade</option>
                    <option value="Adaptacao">Adaptação</option>
                    <option value="Iniciante">Iniciante</option>
                    <option value="Intermediario">Intermediário</option>
                    <option value="Avancado">Avançado</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-orientacaoProfessor" className="block text-gray-300 text-sm font-bold mb-2">Orientações do Professor:</label>
                  <textarea
                    id="edit-orientacaoProfessor"
                    name="orientacao_professor"
                    value={planoFormData.orientacao_professor}
                    onChange={handlePlanoFormInputChange}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline bg-gray-200 h-24 resize-none"
                    placeholder="Ex: Aquecimento: 5 min de cardio. Fazer os exercícios com boa forma..."
                  ></textarea>
                </div>
              </div>

              <div className="flex justify-end space-x-4 mt-6">
                <button
                  type="button"
                  onClick={handleCloseEditPlanoModal}
                  className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-full transition duration-300"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleUpdatePlano}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-full shadow-lg transition duration-300"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Atualizando Plano...' : 'Salvar Alterações'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal para Criar Rotina Diária */}
        {showCreateRotinaModal && currentPlano && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
              <h2 className="text-3xl font-bold text-lime-400 mb-6 text-center">
                Criar Nova Rotina para {currentPlano.nome}
              </h2>
              {error && <p className="text-red-500 text-center mb-4">{error}</p>}
              
              <div className="mb-4">
                <label htmlFor="rotinaNome" className="block text-gray-300 text-sm font-bold mb-2">Nome da Rotina:</label>
                <input
                  type="text"
                  id="rotinaNome"
                  name="nome"
                  value={rotinaFormData.nome}
                  onChange={handleRotinaFormInputChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline bg-gray-200"
                  placeholder="Ex: Treino A, Treino de Perna, Dia 1"
                  required
                />
              </div>
              <div className="mb-6">
                <label htmlFor="rotinaDescricao" className="block text-gray-300 text-sm font-bold mb-2">Descrição da Rotina (Opcional):</label>
                <textarea
                  id="rotinaDescricao"
                  name="descricao"
                  rows={2}
                  value={rotinaFormData.descricao}
                  onChange={handleRotinaFormInputChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline bg-gray-200 h-24 resize-none"
                  placeholder="Ex: Foco em força e hipertrofia de membros inferiores..."
                ></textarea>
              </div>

              <h3 className="text-xl font-bold text-lime-300 mb-4">Adicionar Exercícios à Rotina:</h3>
              <div className="mb-4 max-h-48 overflow-y-auto border border-gray-700 p-2 rounded">
                {exerciciosBiblioteca.length === 0 ? (
                  <p className="text-gray-400">Nenhum exercício disponível. Adicione na Biblioteca de Exercícios.</p>
                ) : (
                  exerciciosBiblioteca.map(ex => (
                    <div key={ex.id} className="flex justify-between items-center bg-gray-700 p-2 rounded mb-1">
                      <span className="text-gray-200">{ex.nome}</span>
                      <button
                        type="button"
                        onClick={() => addExercicioToRotinaModal(ex)}
                        className="bg-green-600 hover:bg-green-700 text-white text-sm py-1 px-3 rounded-full"
                      >
                        Adicionar
                      </button>
                    </div>
                  ))
                )}
              </div>

              <h3 className="text-xl font-bold text-lime-300 mb-4">Exercícios na Rotina:</h3>
              {exerciciosNaRotinaModal.length === 0 ? (
                <p className="text-gray-400 mb-4">Nenhum exercício selecionado para esta rotina.</p>
              ) : (
                <div className="mb-6 border border-gray-700 p-2 rounded max-h-48 overflow-y-auto">
                  {exerciciosNaRotinaModal.map(ex => {
                    const fullEx = exerciciosBiblioteca.find(e => e.id === ex.exercicio_id);
                    return (
                      <div key={ex.id} className="bg-gray-700 p-3 rounded mb-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-gray-200 font-semibold">{fullEx?.nome || 'Exercício Desconhecido'}</span>
                        <div className="flex items-center gap-2">
                          <label className="text-gray-300 text-sm">Séries:</label>
                          <input
                            type="number"
                            value={ex.series || ''}
                            onChange={(e) => updateExercicioNaRotinaModal(ex.id, 'series', parseInt(e.target.value) || null)}
                            className="w-16 py-1 px-2 rounded text-gray-900 bg-gray-300"
                            min="0"
                          />
                          <label className="text-gray-300 text-sm">Repetições:</label>
                          <input
                            type="text"
                            value={ex.repeticoes || ''}
                            onChange={(e) => updateExercicioNaRotinaModal(ex.id, 'repeticoes', e.target.value)}
                            className="w-24 py-1 px-2 rounded text-gray-900 bg-gray-300"
                            placeholder="Ex: 8-12"
                          />
                          <label className="text-gray-300 text-sm">Carga:</label>
                          <input
                            type="text"
                            value={ex.carga || ''}
                            onChange={(e) => updateExercicioNaRotinaModal(ex.id, 'carga', e.target.value)}
                            className="w-24 py-1 px-2 rounded text-gray-900 bg-gray-300"
                            placeholder="Ex: 10kg"
                          />
                          <label className="text-gray-300 text-sm">Intervalo:</label>
                          <input
                            type="text"
                            value={ex.intervalo || ''}
                            onChange={(e) => updateExercicioNaRotinaModal(ex.id, 'intervalo', e.target.value)}
                            className="w-24 py-1 px-2 rounded text-gray-900 bg-gray-300"
                            placeholder="Ex: 60s"
                          />
                          <label className="text-gray-300 text-sm">Observações:</label>
                          <textarea
                            rows={1}
                            value={ex.observacoes || ''}
                            onChange={(e) => updateExercicioNaRotinaModal(ex.id, 'observacoes', e.target.value)}
                            className="w-full py-1 px-2 rounded text-gray-900 bg-gray-300"
                            placeholder="Obs..."
                          ></textarea>
                          <button
                            type="button"
                            onClick={() => removeExercicioNaRotinaModal(ex.id)}
                            className="bg-red-600 hover:bg-red-700 text-white text-sm py-1 px-2 rounded-full"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-end space-x-4 mt-6">
                <button
                  type="button"
                  onClick={handleCloseCreateRotinaModal}
                  className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-full transition duration-300"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreateRotina}
                  className="bg-lime-600 hover:bg-lime-700 text-white font-bold py-2 px-6 rounded-full shadow-lg transition duration-300"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Criando Rotina...' : 'Salvar Rotina'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}