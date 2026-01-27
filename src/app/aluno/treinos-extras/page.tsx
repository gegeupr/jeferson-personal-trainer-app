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

      // ✅ Valida role via profiles (não app_metadata)
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
        setTreinosExtras((data as TreinoExtra[]) || []);
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
      <main className="min-h-screen bg-gray-950 flex items-center justify-center text-lime-300 text-xl">
        Carregando treinos extras…
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-950 text-white px-6 py-10">
        <div className="max-w-3xl mx-auto rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-red-200">{error}</p>
          <div className="mt-4">
            <Link
              href="/aluno/dashboard"
              className="inline-flex rounded-2xl bg-lime-400 px-4 py-2 text-sm font-bold text-black hover:bg-lime-300"
            >
              Voltar ao dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white px-6 py-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-white/60 text-sm">Aluno • Motion</p>
            <h1 className="mt-1 text-3xl font-extrabold">
              Treinos <span className="text-lime-300">Extras</span>
            </h1>
            <p className="mt-2 text-white/60 text-sm">
              Treinos complementares enviados pelo seu professor.
            </p>
          </div>

          <Link
            href="/aluno/dashboard"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
          >
            Voltar
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4">
          {treinosExtras.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-white/70">
              Nenhum treino extra disponível no momento.
            </div>
          ) : (
            treinosExtras.map((t) => {
              const open = expandedTreinoId === t.id;
              return (
                <div key={t.id} className="rounded-3xl border border-white/10 bg-white/5 overflow-hidden">
                  <button
                    onClick={() => setExpandedTreinoId(open ? null : t.id)}
                    className="w-full text-left p-6 hover:bg-white/5 transition flex items-center justify-between gap-4"
                  >
                    <div>
                      <p className="text-lg font-bold text-white">{t.nome}</p>
                      {t.descricao ? <p className="text-sm text-white/60 mt-1">{t.descricao}</p> : null}
                    </div>
                    <span className="text-white/50">{open ? "−" : "+"}</span>
                  </button>

                  {open ? (
                    <div className="px-6 pb-6">
                      <div className="grid grid-cols-1 gap-3">
                        {(t.treinos_extras_exercicios || [])
                          .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
                          .map((e) => (
                            <div
                              key={e.id}
                              className="rounded-2xl border border-white/10 bg-black/30 p-4"
                            >
                              <p className="font-bold text-lime-300">
                                {e.ordem}. {e.exercicios?.nome || "Exercício"}
                              </p>

                              <p className="text-sm text-white/60 mt-1">
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
                                <p className="text-sm text-white/60 mt-2">{e.observacoes}</p>
                              ) : null}

                              {e.exercicios?.link_youtube ? (
                                <a
                                  href={e.exercicios.link_youtube}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex mt-3 text-sm font-semibold text-lime-300 hover:underline"
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
