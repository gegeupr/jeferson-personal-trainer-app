"use client";

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/utils/supabase-browser';
import Link from 'next/link';

interface Arquivo {
  id: string;
  nome_arquivo: string;
  url: string;
  aluno_id: string;
  professor_id: string;
  tipo: string | null;
  created_at: string;
}

interface AlunoProfile {
  nome_completo: string | null;
}

export default function ArquivosAlunoPage() {
    const router = useRouter();
    const params = useParams();
    const alunoId = params.alunoId as string;
    
    const [arquivos, setArquivos] = useState<Arquivo[]>([]);
    const [alunoProfile, setAlunoProfile] = useState<AlunoProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchArquivos() {
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

            const { data: arquivosData, error: arquivosError } = await supabase
                .from('arquivos')
                .select('*')
                .eq('aluno_id', alunoId)
                .order('created_at', { ascending: false });
            
            if (arquivosError) {
                console.error('Erro ao buscar arquivos:', arquivosError.message);
                setError('Não foi possível carregar os arquivos do aluno.');
            } else {
                setArquivos(arquivosData || []);
            }
            
            setLoading(false);
        }
        fetchArquivos();
    }, [router, alunoId]);

    const handleDownload = (url: string, nomeArquivo: string) => {
        window.open(url, '_blank');
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
                <Link href={`/professor/alunos/${alunoId}`} className="mt-4 bg-lime-400 text-gray-900 py-2 px-6 rounded-full hover:bg-lime-300 transition duration-300">
                    Voltar para o aluno
                </Link>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gray-950 text-white py-16 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-4xl font-bold text-lime-400 mb-4 text-center">
                    Arquivos de {alunoProfile?.nome_completo || 'Aluno'}
                </h1>
                <div className="flex justify-start items-center mb-8">
                    <Link href={`/professor/alunos/${alunoId}`} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-full transition duration-300">
                        &larr; Voltar
                    </Link>
                </div>

                <section className="bg-gray-800 p-8 rounded-lg shadow-xl border-t-4 border-lime-400">
                    <h2 className="text-2xl font-bold text-white mb-6">Arquivos Recebidos</h2>
                    {arquivos.length === 0 ? (
                        <p className="text-gray-400 text-center">Nenhum arquivo enviado por este aluno.</p>
                    ) : (
                        <div className="space-y-4">
                            {arquivos.map(arquivo => (
                                <div key={arquivo.id} className="bg-gray-900 p-4 rounded-lg flex justify-between items-center">
                                    <div>
                                        <a 
                                            href={arquivo.url} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="text-lime-300 font-semibold hover:underline"
                                        >
                                            {arquivo.nome_arquivo}
                                        </a>
                                        <p className="text-gray-400 text-sm">Tipo: {arquivo.tipo || 'N/A'}</p>
                                        <p className="text-gray-500 text-xs">Data de envio: {new Date(arquivo.created_at).toLocaleDateString()}</p>
                                    </div>
                                    <button
                                        onClick={() => handleDownload(arquivo.url, arquivo.nome_arquivo)}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm"
                                    >
                                        Download
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