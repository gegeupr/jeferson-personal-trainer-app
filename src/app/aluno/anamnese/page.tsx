// src/app/aluno/anamnese/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import Link from 'next/link'; // Importar Link

interface AnamneseData {
  id: string;
  aluno_id: string;
  historico_saude_doencas: string | null;
  historico_lesoes_cirurgias: string | null;
  medicamentos_suplementos: string | null;
  alergias: string | null;
  fumante_alcool: string | null;
  nivel_atividade_fisica_atual: string | null;
  objetivos_principais: string | null;
  restricoes_alimentares: string | null;
  disponibilidade_treino: string | null;
  observacoes_gerais: string | null;
}

export default function MinhaAnamnesePage() {
  const router = useRouter();
  const [alunoId, setAlunoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anamnese, setAnamnese] = useState<AnamneseData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estado do formulário
  const [formData, setFormData] = useState<Omit<AnamneseData, 'id' | 'aluno_id' | 'created_at'>>({
    historico_saude_doencas: '',
    historico_lesoes_cirurgias: '',
    medicamentos_suplementos: '',
    alergias: '',
    fumante_alcool: '',
    nivel_atividade_fisica_atual: '',
    objetivos_principais: '',
    restricoes_alimentares: '',
    disponibilidade_treino: '',
    observacoes_gerais: '',
  });

  useEffect(() => {
    async function checkUserAndFetchAnamnese() {
      setLoading(true);
      setError(null);

      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push('/login');
        return;
      }
      setAlunoId(user.id);

      // Verificar role do usuário (deve ser 'aluno' do JWT)
      const userRole = user.app_metadata?.user_role as string || null;
      if (userRole !== 'aluno') {
        setError('Acesso negado. Esta página é apenas para alunos.');
        setLoading(false);
        return;
      }

      // Tenta buscar a anamnese existente
      const { data, error: fetchError } = await supabase
        .from('anamneses')
        .select('*')
        .eq('aluno_id', user.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = No rows found
        console.error('Erro ao buscar anamnese:', fetchError.message);
        setError('Não foi possível carregar sua anamnese.');
      } else if (data) {
        setAnamnese(data);
        // Preenche o formulário com os dados existentes
        setFormData({
          historico_saude_doencas: data.historico_saude_doencas || '',
          historico_lesoes_cirurgias: data.historico_lesoes_cirurgias || '',
          medicamentos_suplementos: data.medicamentos_suplementos || '',
          alergias: data.alergias || '',
          fumante_alcool: data.fumante_alcool || '',
          nivel_atividade_fisica_atual: data.nivel_atividade_fisica_atual || '',
          objetivos_principais: data.objetivos_principais || '',
          restricoes_alimentares: data.restricoes_alimentares || '',
          disponibilidade_treino: data.disponibilidade_treino || '',
          observacoes_gerais: data.observacoes_gerais || '',
        });
      }
      setLoading(false);
    }

    checkUserAndFetchAnamnese();
  }, [router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (!alunoId) {
      setError('ID do aluno não encontrado. Tente recarregar a página.');
      setIsSubmitting(false);
      return;
    }

    try {
      if (anamnese) {
        // Atualizar anamnese existente
        const { error: updateError } = await supabase
          .from('anamneses')
          .update(formData)
          .eq('aluno_id', alunoId);

        if (updateError) throw updateError;
        alert('Anamnese atualizada com sucesso!');
      } else {
        // Inserir nova anamnese
        const { error: insertError } = await supabase
          .from('anamneses')
          .insert({ ...formData, aluno_id: alunoId });

        if (insertError) throw insertError;
        alert('Anamnese salva com sucesso!');
      }
      // Após salvar/atualizar, recarrega os dados para refletir as mudanças
      const { data, error: fetchErrorAfterSave } = await supabase
        .from('anamneses')
        .select('*')
        .eq('aluno_id', alunoId)
        .single();
      if (!fetchErrorAfterSave) setAnamnese(data);

    } catch (err: any) {
      console.error('Erro ao salvar anamnese:', err.message);
      setError('Erro ao salvar anamnese: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center text-lime-400 text-2xl">
        Carregando anamnese...
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
        <h1 className="text-4xl font-bold text-lime-400 mb-8 text-center">Minha Anamnese</h1>

        {/* Botão Voltar ao Dashboard */}
        <div className="flex justify-start items-center mb-8">
          <Link href="/dashboard" className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-full transition duration-300">
            &larr; Voltar ao Dashboard
          </Link>
        </div>

        <section className="bg-gray-800 p-8 rounded-lg shadow-xl border-t-4 border-lime-400">
          <h2 className="text-2xl font-bold text-white mb-6">
            {anamnese ? 'Editar Minha Anamnese' : 'Preencher Minha Anamnese'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Histórico de Saúde e Doenças */}
            <div>
              <label htmlFor="historico_saude_doencas" className="block text-gray-300 text-sm font-bold mb-2">
                Histórico de Saúde e Doenças:
              </label>
              <textarea
                id="historico_saude_doencas"
                name="historico_saude_doencas"
                rows={3}
                value={formData.historico_saude_doencas || ''}
                onChange={handleInputChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline bg-gray-200 resize-none"
                placeholder="Ex: Diabetes, hipertensão, problemas cardíacos..."
              ></textarea>
            </div>

            {/* Histórico de Lesões e Cirurgias */}
            <div>
              <label htmlFor="historico_lesoes_cirurgias" className="block text-gray-300 text-sm font-bold mb-2">
                Histórico de Lesões e Cirurgias:
              </label>
              <textarea
                id="historico_lesoes_cirurgias"
                name="historico_lesoes_cirurgias"
                rows={3}
                value={formData.historico_lesoes_cirurgias || ''}
                onChange={handleInputChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline bg-gray-200 resize-none"
                placeholder="Ex: Cirurgia no joelho, dores lombares, tendinite no ombro..."
              ></textarea>
            </div>

            {/* Medicamentos e Suplementos */}
            <div>
              <label htmlFor="medicamentos_suplementos" className="block text-gray-300 text-sm font-bold mb-2">
                Medicamentos e Suplementos (uso contínuo):
              </label>
              <textarea
                id="medicamentos_suplementos"
                name="medicamentos_suplementos"
                rows={3}
                value={formData.medicamentos_suplementos || ''}
                onChange={handleInputChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline bg-gray-200 resize-none"
                placeholder="Ex: Insulina, anti-inflamatórios, whey protein..."
              ></textarea>
            </div>

            {/* Alergias */}
            <div>
              <label htmlFor="alergias" className="block text-gray-300 text-sm font-bold mb-2">
                Alergias:
              </label>
              <input
                type="text"
                id="alergias"
                name="alergias"
                value={formData.alergias || ''}
                onChange={handleInputChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline bg-gray-200"
                placeholder="Ex: Alergia a algum alimento, medicamento..."
              />
            </div>

            {/* Fumante/Álcool */}
            <div>
              <label htmlFor="fumante_alcool" className="block text-gray-300 text-sm font-bold mb-2">
                Fumante / Consumo de Álcool:
              </label>
              <select
                id="fumante_alcool"
                name="fumante_alcool"
                value={formData.fumante_alcool || ''}
                onChange={handleInputChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline bg-gray-200"
              >
                <option value="">Selecione</option>
                <option value="Nao Fumante / Nao Consumo">Não Fumante / Não Consumo</option>
                <option value="Fumante / Nao Consumo">Fumante / Não Consumo</option>
                <option value="Nao Fumante / Consumo Moderado">Não Fumante / Consumo Moderado</option>
                <option value="Fumante / Consumo Moderado">Fumante / Consumo Moderado</option>
                <option value="Fumante / Consumo Excessivo">Fumante / Consumo Excessivo</option>
              </select>
            </div>

            {/* Nível de Atividade Física Atual */}
            <div>
              <label htmlFor="nivel_atividade_fisica_atual" className="block text-gray-300 text-sm font-bold mb-2">
                Nível de Atividade Física Atual:
              </label>
              <select
                id="nivel_atividade_fisica_atual"
                name="nivel_atividade_fisica_atual"
                value={formData.nivel_atividade_fisica_atual || ''}
                onChange={handleInputChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline bg-gray-200"
              >
                <option value="">Selecione</option>
                <option value="Sedentario">Sedentário</option>
                <option value="Pouco Ativo">Pouco Ativo</option>
                <option value="Ativo">Ativo</option>
                <option value="Muito Ativo">Muito Ativo</option>
              </select>
            </div>

            {/* Objetivos Principais */}
            <div>
              <label htmlFor="objetivos_principais" className="block text-gray-300 text-sm font-bold mb-2">
                Objetivos Principais com o Treino:
              </label>
              <textarea
                id="objetivos_principais"
                name="objetivos_principais"
                rows={3}
                value={formData.objetivos_principais || ''}
                onChange={handleInputChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline bg-gray-200 resize-none"
                placeholder="Ex: Perder peso, ganhar massa muscular, melhorar condicionamento..."
              ></textarea>
            </div>

            {/* Restrições Alimentares */}
            <div>
              <label htmlFor="restricoes_alimentares" className="block text-gray-300 text-sm font-bold mb-2">
                Restrições Alimentares ou Dieta:
              </label>
              <textarea
                id="restricoes_alimentares"
                name="restricoes_alimentares"
                rows={3}
                value={formData.restricoes_alimentares || ''}
                onChange={handleInputChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline bg-gray-200 resize-none"
                placeholder="Ex: Vegetariano, vegano, intolerância à lactose..."
              ></textarea>
            </div>

            {/* Disponibilidade de Treino */}
            <div>
              <label htmlFor="disponibilidade_treino" className="block text-gray-300 text-sm font-bold mb-2">
                Disponibilidade para Treinar (dias/horários):
              </label>
              <textarea
                id="disponibilidade_treino"
                name="disponibilidade_treino"
                rows={3}
                value={formData.disponibilidade_treino || ''}
                onChange={handleInputChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline bg-gray-200 resize-none"
                placeholder="Ex: Seg, Qua, Sex - 18h às 19h; Finais de semana pela manhã..."
              ></textarea>
            </div>

            {/* Observações Gerais */}
            <div>
              <label htmlFor="observacoes_gerais" className="block text-gray-300 text-sm font-bold mb-2">
                Observações Gerais:
              </label>
              <textarea
                id="observacoes_gerais"
                name="observacoes_gerais"
                rows={3}
                value={formData.observacoes_gerais || ''}
                onChange={handleInputChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline bg-gray-200 resize-none"
                placeholder="Ex: Condições médicas importantes, histórico familiar, metas de longo prazo..."
              ></textarea>
            </div>

            <button
              type="submit"
              className="bg-lime-600 hover:bg-lime-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300 text-lg w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Salvando Anamnese...' : 'Salvar Anamnese'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}