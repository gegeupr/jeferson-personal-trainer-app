"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import Image from 'next/image';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';

interface ProgressoFoto {
  id: string;
  url: string;
  descricao: string | null;
  data_foto: string | null;
  created_at: string;
}

export default function MeuProgressoPage() {
  const router = useRouter();
  const [alunoId, setAlunoId] = useState<string | null>(null);
  const [fotos, setFotos] = useState<ProgressoFoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados para o formulário de upload
  const [fotoSelecionada, setFotoSelecionada] = useState<File | null>(null);
  const [descricaoFoto, setDescricaoFoto] = useState('');
  const [dataFoto, setDataFoto] = useState('');

  useEffect(() => {
    async function fetchProgressPhotos() {
      setLoading(true);
      setError(null);

      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push('/login');
        return;
      }
      
      setAlunoId(user.id);
      
      const { data: fotosData, error: fetchError } = await supabase
        .from('progresso_fotos')
        .select('*')
        .eq('aluno_id', user.id)
        .order('data_foto', { ascending: false });

      if (fetchError) {
        console.error('Erro ao buscar fotos:', fetchError.message);
        setError('Não foi possível carregar suas fotos de progresso.');
      } else {
        setFotos(fotosData || []);
      }

      setLoading(false);
    }
    fetchProgressPhotos();
  }, [router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFotoSelecionada(e.target.files[0]);
    } else {
      setFotoSelecionada(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (!alunoId || !fotoSelecionada) {
      setError('Por favor, selecione uma foto para enviar.');
      setIsSubmitting(false);
      return;
    }

    try {
      const fileExt = fotoSelecionada.name.split('.').pop();
      const filePath = `${alunoId}/${uuidv4()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('progressphotos')
        .upload(filePath, fotoSelecionada);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('progressphotos')
        .getPublicUrl(filePath);

      if (!publicUrlData) {
        throw new Error('Não foi possível obter a URL pública da foto.');
      }

      const { data: dbData, error: dbError } = await supabase
        .from('progresso_fotos')
        .insert({
          aluno_id: alunoId,
          url: publicUrlData.publicUrl,
          descricao: descricaoFoto.trim() || null,
          data_foto: dataFoto || null,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      setFotos(prev => [dbData, ...prev]);
      setFotoSelecionada(null);
      setDescricaoFoto('');
      setDataFoto('');
      alert('Foto de progresso enviada com sucesso!');

    } catch (err: any) {
      console.error('Erro ao fazer upload:', err.message);
      setError(`Erro ao enviar foto: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center text-lime-400 text-2xl">
        Carregando fotos de progresso...
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-red-500 text-lg p-4">
        <p>{error}</p>
        <Link href="/dashboard" className="mt-4 bg-lime-400 text-gray-900 py-2 px-6 rounded-full hover:bg-lime-300 transition duration-300">
          Voltar ao Dashboard
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-lime-400 mb-8 text-center">Meu Progresso</h1>

        <div className="flex justify-start items-center mb-8">
          <Link href="/dashboard" className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-full transition duration-300">
            &larr; Voltar ao Dashboard
          </Link>
        </div>

        <section className="bg-gray-800 p-8 rounded-lg shadow-xl border-t-4 border-lime-400 mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">Enviar Nova Foto</h2>
          {error && <p className="text-red-500 text-center mb-4">{error}</p>}
          <form onSubmit={handleUpload} className="space-y-6">
            <div>
              <label htmlFor="foto" className="block text-gray-300 text-sm font-bold mb-2">Selecionar Foto:</label>
              <input
                type="file"
                id="foto"
                accept="image/*"
                onChange={handleFileChange}
                className="block w-full text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-lime-500 file:text-gray-900 hover:file:bg-lime-400"
                required
              />
              {fotoSelecionada && <p className="text-gray-400 text-sm mt-2">Arquivo selecionado: {fotoSelecionada.name}</p>}
            </div>
            <div>
              <label htmlFor="dataFoto" className="block text-gray-300 text-sm font-bold mb-2">Data da Foto:</label>
              <input
                type="date"
                id="dataFoto"
                value={dataFoto}
                onChange={(e) => setDataFoto(e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline bg-gray-200"
              />
            </div>
            <div>
              <label htmlFor="descricaoFoto" className="block text-gray-300 text-sm font-bold mb-2">Descrição (Opcional):</label>
              <textarea
                id="descricaoFoto"
                rows={3}
                value={descricaoFoto}
                onChange={(e) => setDescricaoFoto(e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline bg-gray-200 resize-none"
                placeholder="Ex: Foto tirada na semana 4."
              ></textarea>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-lime-600 hover:bg-lime-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300 text-lg w-full"
            >
              {isSubmitting ? 'Enviando...' : 'Enviar Foto'}
            </button>
          </form>
        </section>

        <section className="bg-gray-800 p-8 rounded-lg shadow-xl border-t-4 border-lime-400">
          <h2 className="text-2xl font-bold text-white mb-6">Minhas Fotos</h2>
          {fotos.length === 0 ? (
            <p className="text-gray-400 text-center">Você ainda não enviou fotos de progresso.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {fotos.map(foto => (
                <div key={foto.id} className="bg-gray-900 p-4 rounded-lg flex flex-col items-center">
                  <div className="relative w-full h-48 mb-4">
                    <Image
                      src={foto.url}
                      alt={foto.descricao || 'Foto de progresso'}
                      fill
                      style={{ objectFit: 'cover' }}
                      className="rounded-md"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  </div>
                  {foto.data_foto && (
                    <p className="text-gray-300 text-sm font-semibold">
                      {new Date(foto.data_foto).toLocaleDateString()}
                    </p>
                  )}
                  {foto.descricao && (
                    <p className="text-gray-400 text-xs mt-1 text-center">{foto.descricao}</p>
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