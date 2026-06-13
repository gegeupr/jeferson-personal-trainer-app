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
      if (authError || !user) { router.push('/login'); return; }

      const { data: profile, error: profileError } = await supabase
        .from('profiles').select('role').eq('id', user.id).single();
      if (profileError || profile?.role !== 'professor') {
        setError('Acesso negado.');
        setLoading(false);
        return;
      }

      const { data: alunoData, error: alunoError } = await supabase
        .from('profiles').select('nome_completo').eq('id', alunoId).single();
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
        setError('Não foi possível carregar os arquivos do aluno.');
      } else {
        setArquivos(arquivosData || []);
      }

      setLoading(false);
    }
    fetchArquivos();
  }, [router, alunoId]);

  const alunoNome = alunoProfile?.nome_completo || 'Aluno';

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-white/40 text-sm">Carregando arquivos…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-lg mx-auto mt-10">
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
          <p className="text-red-300 text-sm font-medium">Erro</p>
          <p className="mt-1 text-white/60 text-sm">{error}</p>
          <Link href="/professor/alunos" className="mt-4 inline-block rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 hover:bg-white/10 transition-colors">
            ← Alunos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-white/40">
          <Link href="/professor/alunos" className="hover:text-white/70 transition-colors">Alunos</Link>
          <span>/</span>
          <Link href={`/professor/alunos/${alunoId}/detalhes`} className="hover:text-white/70 transition-colors">{alunoNome}</Link>
          <span>/</span>
          <span className="text-white/60">Arquivos</span>
        </div>

        <h1 className="text-2xl font-bold text-white">Arquivos</h1>

        {arquivos.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-8 text-center">
            <p className="text-white/40 text-sm">Nenhum arquivo enviado por este aluno.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] divide-y divide-white/8">
            {arquivos.map((arquivo) => (
              <div key={arquivo.id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <a
                    href={arquivo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-white hover:text-white/70 transition-colors truncate block"
                  >
                    {arquivo.nome_arquivo}
                  </a>
                  <p className="text-xs text-white/40 mt-0.5">
                    {arquivo.tipo || 'Sem tipo'} · {new Date(arquivo.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <button
                  onClick={() => window.open(arquivo.url, '_blank')}
                  className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 transition-colors"
                >
                  Abrir
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
