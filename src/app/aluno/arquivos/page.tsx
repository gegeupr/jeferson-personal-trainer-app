"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';

interface Arquivo {
  id: string;
  nome_arquivo: string;
  url: string;
  aluno_id: string;
  professor_id: string;
  tipo: string | null;
  created_at: string;
  public_id: string;
}

export default function ArquivosPage() {
  const router = useRouter();
  const [alunoId, setAlunoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [arquivos, setArquivos] = useState<Arquivo[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Estados para o formulário de upload
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null);

  useEffect(() => {
    async function checkUserAndFetchArquivos() {
      setLoading(true);
      setError(null);

      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push('/login');
        return;
      }
      setAlunoId(user.id);
      
      const { data: arquivosData, error: arquivosError } = await supabase
        .from('arquivos')
        .select('*')
        .eq('aluno_id', user.id)
        .order('created_at', { ascending: false });

      if (arquivosError) {
        console.error('Erro ao buscar arquivos:', arquivosError.message);
        setError('Não foi possível carregar seus arquivos.');
      } else {
        setArquivos(arquivosData || []);
      }
      setLoading(false);
    }
    checkUserAndFetchArquivos();
  }, [router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setArquivoSelecionado(e.target.files[0]);
    } else {
      setArquivoSelecionado(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setFeedbackMessage(null);

    if (!alunoId || !arquivoSelecionado || !nomeArquivo.trim()) {
      setError('Por favor, preencha o nome do arquivo e selecione um arquivo para enviar.');
      setIsSubmitting(false);
      return;
    }

    try {
      const fileExt = arquivoSelecionado.name.split('.').pop();
      const filePath = `${alunoId}/${uuidv4()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('arquivo')
        .upload(filePath, arquivoSelecionado);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('arquivo')
        .getPublicUrl(filePath);

      if (!publicUrlData) {
        throw new Error('Não foi possível obter a URL pública do arquivo.');
      }

      const { data: dbData, error: dbError } = await supabase
        .from('arquivos')
        .insert({
          aluno_id: alunoId,
          nome_arquivo: nomeArquivo.trim(),
          url: publicUrlData.publicUrl,
          tipo: arquivoSelecionado.type,
          public_id: filePath,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      setArquivos(prev => [dbData, ...prev]);
      setNomeArquivo('');
      setArquivoSelecionado(null);
      setFeedbackMessage('Arquivo enviado com sucesso!');

    } catch (err: unknown) { // CORREÇÃO: Usando "unknown" para tratamento seguro de erros
      if (err instanceof Error) {
        console.error('Erro ao fazer upload:', err.message);
        setError(`Erro ao enviar arquivo: ${err.message}`);
      } else {
        console.error('Ocorreu um erro desconhecido ao fazer upload.');
        setError('Erro ao enviar arquivo: Ocorreu um erro desconhecido.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteFile = async (arquivoId: string) => {
    // CORREÇÃO: Removendo o confirm() e usando um modal ou feedback na UI
    setIsSubmitting(true);
    setError(null);
    setFeedbackMessage(null);

    const arquivoParaDeletar = arquivos.find(a => a.id === arquivoId);
    if (!arquivoParaDeletar) {
      setError('Arquivo não encontrado para exclusão.');
      setIsSubmitting(false);
      return;
    }

    try {
      const { error: storageError } = await supabase.storage
        .from('arquivo')
        .remove([arquivoParaDeletar.public_id]);
      
      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('arquivos')
        .delete()
        .eq('id', arquivoId);
      
      if (dbError) throw dbError;

      setArquivos(prev => prev.filter(a => a.id !== arquivoId));
      setFeedbackMessage('Arquivo excluído com sucesso!');

    } catch (err: unknown) { // CORREÇÃO: Usando "unknown"
      if (err instanceof Error) {
        console.error('Erro ao excluir arquivo:', err.message);
        setError('Erro ao excluir arquivo: ' + err.message);
      } else {
        console.error('Ocorreu um erro desconhecido ao excluir arquivo.');
        setError('Erro ao excluir arquivo: Ocorreu um erro desconhecido.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center text-lime-400 text-2xl">
        Carregando arquivos...
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
        <h1 className="text-4xl font-bold text-lime-400 mb-8 text-center">Meus Arquivos</h1>

        <div className="flex justify-start items-center mb-8">
          <Link href="/dashboard" className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-full transition duration-300">
            &larr; Voltar ao Dashboard
          </Link>
        </div>
        {feedbackMessage && (
            <div className="bg-green-500 text-white p-3 rounded-lg text-center mb-4">
              {feedbackMessage}
            </div>
          )}

        <section className="bg-gray-800 p-8 rounded-lg shadow-xl border-t-4 border-lime-400 mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">Enviar Novo Arquivo</h2>
          {error && <p className="text-red-500 text-center mb-4">{error}</p>}
          <form onSubmit={handleUpload} className="space-y-6">
            <div>
              <label htmlFor="nomeArquivo" className="block text-gray-300 text-sm font-bold mb-2">Nome do Arquivo:</label>
              <input
                type="text"
                id="nomeArquivo"
                value={nomeArquivo}
                onChange={(e) => setNomeArquivo(e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline bg-gray-200"
                placeholder="Ex: Exame de Sangue de Junho"
                required
              />
            </div>
            <div>
              <label htmlFor="arquivo" className="block text-gray-300 text-sm font-bold mb-2">Selecionar Arquivo:</label>
              <input
                type="file"
                id="arquivo"
                onChange={handleFileChange}
                className="block w-full text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-lime-500 file:text-gray-900 hover:file:bg-lime-400"
                required
              />
              {arquivoSelecionado && <p className="text-gray-400 text-sm mt-2">Arquivo selecionado: {arquivoSelecionado.name}</p>}
            </div>
            <button
              type="submit"
              className="bg-lime-600 hover:bg-lime-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300 text-lg w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Enviando...' : 'Enviar Arquivo'}
            </button>
          </form>
        </section>

        <section className="bg-gray-800 p-8 rounded-lg shadow-xl border-t-4 border-lime-400">
          <h2 className="text-2xl font-bold text-white mb-6">Meus Arquivos</h2>
          {arquivos.length === 0 ? (
            <p className="text-gray-400 text-center">Você ainda não enviou nenhum arquivo.</p>
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
                  <button onClick={() => handleDeleteFile(arquivo.id)} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm" disabled={isSubmitting}>
                    Excluir
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}