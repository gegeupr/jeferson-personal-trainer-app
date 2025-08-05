"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { CldUploadWidget, CldUploadWidgetProps } from 'next-cloudinary';
import Link from 'next/link';

interface ProgressoFoto {
  id: string;
  url: string;
  descricao: string | null;
  tipo: string | null;
  data_foto: string | null;
  public_id: string;
}

export default function MeuProgressoPage() {
  const router = useRouter();
  const [alunoId, setAlunoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fotos, setFotos] = useState<ProgressoFoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);

  // Estados para os novos campos de upload
  const [uploadDescricao, setUploadDescricao] = useState('');
  const [uploadTipo, setUploadTipo] = useState('');
  const [uploadDataFoto, setUploadDataFoto] = useState('');

  // Variáveis de ambiente do Cloudinary
  const cloudinaryCloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

  useEffect(() => {
    async function checkUserAndFetchPhotos() {
      setLoading(true);
      setError(null);

      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push('/login');
        return;
      }
      setAlunoId(user.id);

      const userRole = user.app_metadata?.user_role as string | null;
      if (userRole !== 'aluno') {
        setError('Acesso negado. Esta página é apenas para alunos.');
        setLoading(false);
        return;
      }

      const { data: fotosData, error: fotosError } = await supabase
        .from('progresso_fotos')
        .select('*')
        .eq('aluno_id', user.id)
        .order('created_at', { ascending: false });

      if (fotosError) {
        console.error('Erro ao buscar fotos:', fotosError.message);
        setError('Não foi possível carregar suas fotos de progresso.');
      } else {
        setFotos(fotosData || []);
      }
      setLoading(false);
    }

    checkUserAndFetchPhotos();
  }, [router]);

  const handleUploadSuccess = async (result: any) => {
    if (result.event === 'success') {
      setUploading(true);
      setError(null);

      if (!uploadDescricao.trim() || !uploadTipo.trim() || !uploadDataFoto.trim()) {
        setError('Por favor, preencha a Descrição, Tipo e Data da foto antes de enviá-la.');
        setUploading(false);
        return;
      }

      const { secure_url, public_id } = result.info;

      const { data, error: insertError } = await supabase
        .from('progresso_fotos')
        .insert({
          aluno_id: alunoId,
          url: secure_url,
          public_id: public_id,
          descricao: uploadDescricao.trim(),
          tipo: uploadTipo.trim(),
          data_foto: uploadDataFoto,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Erro ao salvar foto no DB:', insertError.message);
        setError('Erro ao salvar foto no banco de dados.');
      } else {
        setFotos(prevFotos => [data, ...prevFotos]);
        alert('Foto enviada e salva com sucesso!');
        setUploadDescricao('');
        setUploadTipo('');
        setUploadDataFoto('');
      }
      setUploading(false);
    }
  };

  const handleDeleteFoto = async (fotoId: string, publicId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta foto?')) return;

    setLoadingDelete(true);
    setError(null);

    try {
      const response = await fetch('/api/cloudinary/delete-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao deletar do Cloudinary.');
      }

      const { error: deleteError } = await supabase
        .from('progresso_fotos')
        .delete()
        .eq('id', fotoId)
        .eq('aluno_id', alunoId);

      if (deleteError) {
        console.error('Erro ao deletar foto do DB:', deleteError.message);
        setError('Erro ao deletar foto do banco de dados.');
      } else {
        setFotos(prevFotos => prevFotos.filter(foto => foto.id !== fotoId));
        alert('Foto excluída com sucesso!');
      }
    } catch (err: any) {
      console.error('Erro ao deletar foto:', err.message);
      setError('Erro ao excluir foto: ' + err.message);
    } finally {
      setLoadingDelete(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center text-lime-400 text-2xl">
        Carregando progresso...
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
        <h1 className="text-4xl font-bold text-lime-400 mb-8 text-center">Meu Progresso</h1>

        <div className="flex justify-start items-center mb-8">
          <Link href="/dashboard" className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-full transition duration-300">
            &larr; Voltar ao Dashboard
          </Link>
        </div>

        <section className="bg-gray-800 p-8 rounded-lg shadow-xl border-t-4 border-lime-400 mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">Enviar Nova Foto de Progresso</h2>
          {!cloudinaryCloudName && (
            <p className="text-red-400 mb-4">Erro de configuração: Cloudinary Cloud Name não encontrado. Verifique seu .env.local</p>
          )}
          {cloudinaryCloudName && (
            <div className="space-y-4">
              <div>
                <label htmlFor="uploadDescricao" className="block text-gray-300 text-sm font-bold mb-2">Descrição da Foto:</label>
                <input
                  type="text"
                  id="uploadDescricao"
                  value={uploadDescricao}
                  onChange={(e) => setUploadDescricao(e.target.value)}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline bg-gray-200"
                  placeholder="Ex: Foto antes do treino"
                />
              </div>
              <div>
                <label htmlFor="uploadTipo" className="block text-gray-300 text-sm font-bold mb-2">Tipo da Foto:</label>
                <select
                  id="uploadTipo"
                  value={uploadTipo}
                  onChange={(e) => setUploadTipo(e.target.value)}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline bg-gray-200"
                >
                  <option value="">Selecione o Tipo</option>
                  <option value="Antes">Antes</option>
                  <option value="Depois">Depois</option>
                  <option value="Atual">Atual</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
              <div>
                <label htmlFor="uploadDataFoto" className="block text-gray-300 text-sm font-bold mb-2">Data da Foto:</label>
                <input
                  type="date"
                  id="uploadDataFoto"
                  value={uploadDataFoto}
                  onChange={(e) => setUploadDataFoto(e.target.value)}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline bg-gray-200"
                />
              </div>

              <CldUploadWidget
                uploadPreset="ml_default"
                onSuccess={handleUploadSuccess}
                options={{ 
                  sources: ['local', 'url'], 
                  tags: ['progresso', alunoId || ''], 
                  clientAllowedFormats: ["png", "gif", "jpeg", "webp"],
                  cloudName: cloudinaryCloudName
                }}
              >
                {({ open }: { open: () => void }) => (
                  <button
                    type="button"
                    onClick={() => {
                      if (!uploadDescricao.trim() || !uploadTipo.trim() || !uploadDataFoto.trim()) {
                        setError('Por favor, preencha a Descrição, Tipo e Data da foto antes de abrir o uploader.');
                        return;
                      }
                      setError(null);
                      open();
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300 text-lg w-full mt-4"
                    disabled={uploading}
                  >
                    {uploading ? 'Enviando...' : 'Fazer Upload de Foto'}
                  </button>
                )}
              </CldUploadWidget>
            </div>
          )}
        </section>

        <section className="bg-gray-800 p-8 rounded-lg shadow-xl border-t-4 border-lime-400">
          <h2 className="text-2xl font-bold text-white mb-6">Minhas Fotos de Progresso</h2>
          {fotos.length === 0 ? (
            <p className="text-gray-400 text-center">Você ainda não enviou nenhuma foto de progresso.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {fotos.map(foto => (
                <div key={foto.id} className="bg-gray-900 rounded-lg shadow-md overflow-hidden relative group">
                  <img
                    src={foto.url}
                    alt={foto.descricao || 'Foto de Progresso'}
                    className="w-full h-48 object-cover"
                  />
                  <div className="p-4">
                    <p className="text-lime-300 font-semibold mb-1">{foto.descricao || 'Sem descrição'}</p>
                    <p className="text-gray-400 text-sm">Tipo: {foto.tipo || 'N/A'}</p>
                    <p className="text-gray-400 text-sm">Data: {foto.data_foto ? new Date(foto.data_foto).toLocaleDateString() : 'N/A'}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteFoto(foto.id, foto.public_id)}
                    className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white text-xs py-1 px-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    disabled={loadingDelete}
                  >
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