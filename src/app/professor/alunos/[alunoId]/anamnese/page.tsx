"use client";

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/utils/supabase-browser';
import Link from 'next/link';

interface Anamnese {
  id: string;
  aluno_id: string;
  data_preenchimento: string;
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

interface AlunoProfile {
  nome_completo: string | null;
}

const CAMPOS: { key: keyof Anamnese; label: string }[] = [
  { key: "historico_saude_doencas", label: "Histórico de saúde e doenças" },
  { key: "historico_lesoes_cirurgias", label: "Lesões e cirurgias" },
  { key: "medicamentos_suplementos", label: "Medicamentos e suplementos" },
  { key: "alergias", label: "Alergias" },
  { key: "fumante_alcool", label: "Fumante / álcool" },
  { key: "nivel_atividade_fisica_atual", label: "Nível de atividade atual" },
  { key: "objetivos_principais", label: "Objetivos principais" },
  { key: "restricoes_alimentares", label: "Restrições alimentares" },
  { key: "disponibilidade_treino", label: "Disponibilidade para treinar" },
  { key: "observacoes_gerais", label: "Observações gerais" },
];

export default function AnamneseAlunoPage() {
  const router = useRouter();
  const params = useParams();
  const alunoId = params.alunoId as string;

  const [anamneseData, setAnamneseData] = useState<Anamnese | null>(null);
  const [alunoProfile, setAlunoProfile] = useState<AlunoProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnamnese() {
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

      const { data: anamnese, error: anamneseError } = await supabase
        .from('anamneses')
        .select('*')
        .eq('aluno_id', alunoId)
        .order('data_preenchimento', { ascending: false })
        .limit(1)
        .single();

      if (anamneseError && anamneseError.code !== 'PGRST116') {
        setError('Não foi possível carregar a anamnese.');
      } else if (anamnese) {
        setAnamneseData(anamnese);
      }

      setLoading(false);
    }
    fetchAnamnese();
  }, [router, alunoId]);

  const alunoNome = alunoProfile?.nome_completo || 'Aluno';

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-white/40 text-sm">Carregando anamnese…</p>
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
          <span className="text-white/60">Anamnese</span>
        </div>

        <h1 className="text-2xl font-bold text-white">Anamnese</h1>

        {!anamneseData ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-8 text-center">
            <p className="text-white/40 text-sm">O aluno ainda não preencheu a anamnese.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] divide-y divide-white/8">
            {CAMPOS.map(({ key, label }) => (
              <div key={key} className="px-5 py-4">
                <p className="text-xs font-medium text-white/50 mb-1">{label}</p>
                <p className="text-sm text-white/80">{(anamneseData[key] as string) || '—'}</p>
              </div>
            ))}
            <div className="px-5 py-4">
              <p className="text-xs text-white/30">
                Última atualização: {new Date(anamneseData.data_preenchimento).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
