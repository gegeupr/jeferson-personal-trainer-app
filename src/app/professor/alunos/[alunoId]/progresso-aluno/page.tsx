"use client";

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import Image from 'next/image';
import Link from 'next/link';

interface ProgressoFoto {
  id: string;
  url: string;
  descricao: string | null;
  data_foto: string | null;
  created_at: string;
}

interface AlunoProfile {
  nome_completo: string | null;
}

export default function ProgressoAlunoProfessorPage() {
  const router = useRouter();
  const params = useParams();
  const alunoId = params.alunoId as string;
  
  const [fotos, setFotos] = useState<ProgressoFoto[]>([]);
  const [alunoProfile, setAlunoProfile] = useState<AlunoProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProgressPhotos() {
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
        .select('nome_completo')
        .eq('id', alunoId)
        .single();
      
      if (alunoError || !alunoData) {
          setError('Aluno não encontrado.');
          setLoading(false);
          return;
      }
      setAlunoProfile(alunoData);

      const { data: fotosData, error: fetchError } = await supabase
        .from('progresso_fotos')
        .select('*')
        .eq('aluno_id', alunoId)
        .order('data_foto', { ascending: false });

      if (fetchError) {
        console.error('Erro ao buscar fotos:', fetchError.message);
        setError('Não foi possível carregar as fotos de progresso.');
      } else {
        setFotos(fotosData || []);
      }

      setLoading(false);
    }
    fetchProgressPhotos();
  }, [router, alunoId]);

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
        <Link href={`/professor/alunos/${alunoId}`} className="mt-4 bg-lime-400 text-gray-900 py-2 px-6 rounded-full hover:bg-lime-300 transition duration-300">
          Voltar para o aluno
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-lime-400 mb-8 text-center">
          Progresso de {alunoProfile?.nome_completo || 'Aluno'}
        </h1>

        <div className="flex justify-start items-center mb-8">
          <Link href={`/professor/alunos/${alunoId}`} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-full transition duration-300">
            &larr; Voltar
          </Link>
        </div>

        <section className="bg-gray-800 p-8 rounded-lg shadow-xl border-t-4 border-lime-400">
          <h2 className="text-2xl font-bold text-white mb-6">Fotos de Progresso</h2>
          {fotos.length === 0 ? (
            <p className="text-gray-400 text-center">O aluno ainda não enviou fotos de progresso.</p>
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