"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/utils/supabase-browser";

interface ExercicioDetalhes {
  id: string;
  nome: string;
  descricao: string | null;
  link_youtube: string | null;
}

interface TreinoExtraExercicio {
  id: string;
  exercicio_id: string;
  ordem: number;
  series: number | null;
  repeticoes: string | null;
  carga: string | null;
  intervalo: string | null;
  observacoes: string | null;
  exercicios: ExercicioDetalhes;
}

interface TreinoExtra {
  id: string;
  nome: string;
  descricao: string | null;
  created_at: string;
  treinos_extras_exercicios: TreinoExtraExercicio[];
}

export default function MeusTreinosExtrasPage() {
  const router = useRouter();
  const [treinosExtras, setTreinosExtras] = useState<TreinoExtra[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTreinoId, setExpandedTreinoId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchTreinosExtras() {
      setLoading(true);
      setError(null);

      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }

      if (profile.role !== "aluno") {
        setError("Acesso negado. Esta página é apenas para alunos.");
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("treinos_extras")
        .select(`
          id,
          nome,
          descricao,
          created_at,
          treinos_extras_exercicios (
            id,
            exercicio_id,
            ordem,
            series,
            repeticoes,
            carga,
            intervalo,
            observacoes,
            exercicios!treinos_extras_exercicios_exercicio_id_fkey(id, nome, descricao, link_youtube)
          )
        `)
        .eq("aluno_id", user.id)
        .order("created_at", { ascending: false });

      if (!mounted) return;

      if (fetchError) {
        console.error("Erro ao buscar treinos extras:", fetchError.message);
        setError("Não foi possível carregar seus treinos extras: " + fetchError.message);
        setTreinosExtras([]);
      } else {
        setTreinosExtras((data as unknown as TreinoExtra[]) || []);
      }

      setLoading(false);
    }

    fetchTreinosExtras();

    return () => {
      mounted = false;
    };
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-white/40 text-sm">Carregando treinos extras…</p>
      </div>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white px-4 py-10">
        <div className="max-w-3xl mx-auto rounded-2xl border border-white/8 bg-white/[0.03] p-6">
          <p className="text-red-300">{error}</p>
          <div className="mt-4">
            <Link
              href="/aluno/dashboard"
              className="inline-flex rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 transition-colors"
            >
              Voltar ao dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white px-4 py-8 pb-16">
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-white/40">
          <Link href="/aluno/dashboard" className="hover:text-white/70 transition-colors">Dashboard</Link>
          <span>/</span>
          <Link href="/aluno/meus-treinos" className="hover:text-white/70 transition-colors">Meus Treinos</Link>
          <span>/</span>
          <span className="text-white/60">Treinos Extras</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-white">Treinos Extras</h1>
          <p className="mt-1 text-white/50 text-sm">
            Treinos complementares enviados pelo seu professor.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {treinosExtras.length === 0 ? (
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-8 text-center">
              <p className="text-white/40 text-sm">Nenhum treino extra disponível no momento.</p>
            </div>
          ) : (
            treinosExtras.map((t) => {
              const open = expandedTreinoId === t.id;
              return (
                <div key={t.id} className="rounded-2xl border border-white/8 bg-white/[0.03] overflow-hidden">
                  <button
                    onClick={() => setExpandedTreinoId(open ? null : t.id)}
                    className="w-full text-left p-5 hover:bg-white/5 transition flex items-center justify-between gap-4"
                  >
                    <div>
                      <p className="font-semibold text-white">{t.nome}</p>
                      {t.descricao ? <p className="text-sm text-white/50 mt-0.5">{t.descricao}</p> : null}
                    </div>
                    <span className="text-white/40 shrink-0">{open ? "−" : "+"}</span>
                  </button>

                  {open ? (
                    <div className="px-5 pb-5">
                      <div className="grid grid-cols-1 gap-2">
                        {(t.treinos_extras_exercicios || [])
                          .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
                          .map((e) => (
                            <div
                              key={e.id}
                              className="rounded-xl border border-white/10 bg-black/30 p-4"
                            >
                              <p className="font-semibold text-white">
                                <span className="text-white/50 mr-2">{e.ordem}.</span>
                                {e.exercicios?.nome || "Exercício"}
                              </p>

                              <p className="text-sm text-white/50 mt-1">
                                {[
                                  e.series ? `${e.series} séries` : null,
                                  e.repeticoes ? `${e.repeticoes} reps` : null,
                                  e.carga ? `carga: ${e.carga}` : null,
                                  e.intervalo ? `intervalo: ${e.intervalo}` : null,
                                ]
                                  .filter(Boolean)
                                  .join(" • ") || "Sem detalhes"}
                              </p>

                              {e.observacoes ? (
                                <p className="text-sm text-white/50 mt-1.5">{e.observacoes}</p>
                              ) : null}

                              {e.exercicios?.link_youtube ? (
                                <a
                                  href={e.exercicios.link_youtube}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex mt-3 text-sm font-semibold text-white/60 hover:text-white hover:underline transition-colors"
                                >
                                  Ver vídeo no YouTube ↗
                                </a>
                              ) : null}
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
