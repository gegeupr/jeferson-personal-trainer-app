"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/utils/supabase-browser";

type ProfProfile = {
  id: string;
  role: "professor" | "aluno";
  nome_completo: string | null;
  telefone: string | null;
  avatar_url?: string | null;
  cover_url?: string | null;
  slug?: string | null;
};

type Aluno = {
  id: string;
  nome_completo: string | null;
  email?: string | null;
  telefone: string | null;
  avatar_url?: string | null;
};

type ConclusaoFeed = {
  id: string;
  concluido_em: string;
  feedback_nota: number | null;
  feedback_texto: string | null;
  aluno_id: string;
  treino_id: string;
  rotina_id: string;
  aluno?: { id: string; nome_completo: string | null; telefone: string | null; avatar_url?: string | null } | null;
  treino?: { id: string; nome: string | null } | null;
  rotina?: { id: string; nome: string | null } | null;
};

function onlyDigits(s: string) {
  return (s || "").replace(/\D/g, "");
}

function waLink(phoneBR: string, msg: string) {
  const phone = onlyDigits(phoneBR);
  if (!phone) return null;
  const full = phone.startsWith("55") ? phone : `55${phone}`;
  return `https://wa.me/${full}?text=${encodeURIComponent(msg)}`;
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-white/70 text-xs">
      {children}
    </span>
  );
}

function StatCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl">
      <p className="text-white/60 text-xs">{title}</p>
      <p className="mt-2 text-3xl font-extrabold text-white">{value}</p>
      {hint ? <p className="mt-2 text-white/50 text-xs">{hint}</p> : null}
    </div>
  );
}

export default function ProfessorDashboardPremium() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [prof, setProf] = useState<ProfProfile | null>(null);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [feed, setFeed] = useState<ConclusaoFeed[]>([]);

  const [treinosCount, setTreinosCount] = useState(0);
  const [alunosCount, setAlunosCount] = useState(0);
  const [concluidosCount, setConcluidosCount] = useState(0);

  const profName = prof?.nome_completo || "Professor";
  const profSlug = prof?.slug || null;

  const publicLink = useMemo(() => {
    if (!profSlug) return null;
    if (typeof window === "undefined") return `/p/${profSlug}`;
    return `${window.location.origin}/p/${profSlug}`;
  }, [profSlug]);

  useEffect(() => {
    let mounted = true;

    async function boot() {
      setLoading(true);
      setErr(null);

      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      // Perfil do professor
      const { data: myProf, error: pErr } = await supabase
        .from("profiles")
        .select("id, role, nome_completo, telefone, avatar_url, cover_url, slug")
        .eq("id", user.id)
        .single();

      if (!mounted) return;

      if (pErr || !myProf) {
        setErr("Não foi possível carregar seu perfil.");
        setLoading(false);
        return;
      }

      if (myProf.role !== "professor") {
        router.replace("/dashboard");
        return;
      }

      setProf(myProf as ProfProfile);

      // Alunos do professor
      const { data: alunosData, error: aErr } = await supabase
        .from("profiles")
        .select("id, nome_completo, telefone, avatar_url")
        .eq("professor_id", user.id)
        .eq("role", "aluno")
        .order("created_at", { ascending: false });

      if (!mounted) return;

      if (!aErr && alunosData) {
        setAlunos(alunosData as any);
        setAlunosCount(alunosData.length);
      } else {
        setAlunos([]);
        setAlunosCount(0);
      }

      // Quantidade de treinos atribuídos (professor -> aluno)
      const { count: tCount } = await supabase
        .from("treinos")
        .select("id", { count: "exact", head: true })
        .eq("professor_id", user.id);

      setTreinosCount(tCount || 0);

      // Feed: últimas rotinas concluídas (se policy permitir)
      const { data: concl, error: cErr } = await supabase
        .from("aluno_rotina_conclusoes")
        .select("id, aluno_id, treino_id, rotina_id, concluido_em, feedback_nota, feedback_texto")
        .order("concluido_em", { ascending: false })
        .limit(12);

      if (!mounted) return;

      if (cErr || !concl) {
        setFeed([]);
        setConcluidosCount(0);
        setLoading(false);
        return;
      }

      setConcluidosCount(concl.length);

      const alunoIds = [...new Set((concl as any[]).map((x) => x.aluno_id))];
      const treinoIds = [...new Set((concl as any[]).map((x) => x.treino_id))];
      const rotinaIds = [...new Set((concl as any[]).map((x) => x.rotina_id))];

      const [alunosMini, treinosMini, rotinasMini] = await Promise.all([
        supabase.from("profiles").select("id, nome_completo, telefone, avatar_url").in("id", alunoIds),
        supabase.from("treinos").select("id, nome").in("id", treinoIds),
        supabase.from("rotinas_diarias").select("id, nome").in("id", rotinaIds),
      ]);

      const alunosMap = new Map((alunosMini.data || []).map((a: any) => [a.id, a]));
      const treinosMap = new Map((treinosMini.data || []).map((t: any) => [t.id, t]));
      const rotinasMap = new Map((rotinasMini.data || []).map((r: any) => [r.id, r]));

      const feedFinal: ConclusaoFeed[] = (concl as any[]).map((x) => ({
        ...x,
        aluno: alunosMap.get(x.aluno_id) || null,
        treino: treinosMap.get(x.treino_id) || null,
        rotina: rotinasMap.get(x.rotina_id) || null,
      }));

      setFeed(feedFinal);
      setLoading(false);
    }

    boot();
    return () => {
      mounted = false;
    };
  }, [router]);

  async function copyPublicLink() {
    if (!publicLink) return;
    try {
      await navigator.clipboard.writeText(publicLink);
      alert("Link do seu perfil público copiado!");
    } catch {
      alert("Não consegui copiar automaticamente. Copie manualmente:\n" + publicLink);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center text-lime-300 text-xl">
        Carregando dashboard do professor…
      </main>
    );
  }

  if (err) {
    return (
      <main className="min-h-screen bg-gray-950 text-white px-6 py-10">
        <div className="max-w-3xl mx-auto rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-red-200">{err}</p>
          <div className="mt-4 flex gap-2">
            <Link
              href="/login"
              className="rounded-2xl bg-lime-400 px-4 py-2 text-sm font-bold text-black hover:bg-lime-300"
            >
              Ir para login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white px-6 py-10">
      <div className="max-w-7xl mx-auto">
        {/* HERO */}
        <div className="rounded-[2rem] border border-white/10 bg-white/5 overflow-hidden shadow-2xl">
          <div className="relative h-48 w-full">
            {prof?.cover_url ? (
              <Image
                src={prof.cover_url}
                alt="Capa"
                fill
                className="object-cover"
                priority
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-lime-400/20 via-black/40 to-black" />
            )}
            <div className="absolute inset-0 bg-black/45" />
          </div>

          <div className="p-6 -mt-10 flex flex-col md:flex-row md:items-end md:justify-between gap-5">
            <div className="flex items-end gap-4">
              <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                {prof?.avatar_url ? (
                  <Image src={prof.avatar_url} alt="Avatar" fill className="object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-lime-300 font-extrabold text-2xl">
                    {(profName || "M").slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>

              <div>
                <p className="text-white/60 text-sm">Professor • Motion</p>
                <h1 className="text-3xl font-extrabold">
                  Bem-vindo, <span className="text-lime-300">{profName}</span>
                </h1>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Pill>Alunos: {alunosCount}</Pill>
                  <Pill>Planos atribuídos: {treinosCount}</Pill>
                  <Pill>Últimos concluídos: {concluidosCount}</Pill>
                </div>
              </div>
            </div>

            {/* Ações rápidas */}
            <div className="flex flex-wrap gap-2">
              <Link
                href="/professor/perfil-publico"
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/80 hover:bg-white/10"
              >
                Meu perfil público
              </Link>

              <Link
                href="/professor/biblioteca"
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/80 hover:bg-white/10"
              >
                Biblioteca
              </Link>

              {/* ✅ BOTÃO NOVO - Comunidade (moderar) */}
              <Link
                href="/professor/community"
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/80 hover:bg-white/10 transition"
              >
                Comunidade (moderar)
              </Link>

              <Link
                href="/professor/treinos"
                className="rounded-2xl bg-lime-400 px-4 py-2 text-sm font-extrabold text-black hover:bg-lime-300"
              >
                Criar/atribuir treino
              </Link>

              <button
                onClick={copyPublicLink}
                disabled={!publicLink}
                className="rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-sm font-bold text-lime-300 hover:bg-white/5 disabled:opacity-40"
              >
                Copiar link “Treinar comigo”
              </button>
            </div>
          </div>
        </div>

        {/* STATS */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard title="Alunos ativos" value={alunosCount} hint="Alunos vinculados ao seu perfil" />
          <StatCard title="Planos atribuídos" value={treinosCount} hint="Treinos criados/atribuídos por você" />
          <StatCard title="Concluídos (recentes)" value={concluidosCount} hint="Últimas rotinas concluídas (feed)" />
        </div>

        {/* GRID */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Alunos */}
          <div className="lg:col-span-1 rounded-3xl border border-white/10 bg-white/5 overflow-hidden">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <p className="font-extrabold text-white">Seus alunos</p>
              <Link
                href="/professor/alunos"
                className="text-sm font-bold text-lime-300 hover:underline"
              >
                Ver tudo
              </Link>
            </div>

            <div className="p-5 space-y-3">
              {alunos.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-white/70">
                  Você ainda não tem alunos vinculados.
                  <p className="mt-2 text-white/50 text-sm">
                    Dica: use o link “Treinar comigo” no seu Instagram/WhatsApp.
                  </p>
                </div>
              ) : (
                alunos.slice(0, 6).map((a) => {
                  const wa = a.telefone
                    ? waLink(a.telefone, `Olá, ${a.nome_completo || "aluno"}! Tudo certo com seus treinos no Motion?`)
                    : null;

                  return (
                    <div key={a.id} className="rounded-2xl border border-white/10 bg-black/30 p-4 flex items-center gap-3">
                      <div className="relative h-10 w-10 rounded-xl overflow-hidden border border-white/10 bg-black/40 flex-shrink-0">
                        {a.avatar_url ? (
                          <Image src={a.avatar_url} alt="Aluno" fill className="object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-lime-300 font-extrabold">
                            {(a.nome_completo || "A").slice(0, 1).toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-white truncate">{a.nome_completo || "Aluno"}</p>
                        <p className="text-xs text-white/50 truncate">{a.telefone || "sem telefone"}</p>
                      </div>

                      {wa ? (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-lime-300 hover:bg-white/10"
                        >
                          WhatsApp
                        </a>
                      ) : (
                        <span className="text-xs text-white/40">—</span>
                      )}
                    </div>
                  );
                })
              )}

              <div className="pt-2">
                <Link
                  href="/professor/treinos"
                  className="block text-center rounded-2xl bg-lime-400 px-4 py-3 text-sm font-extrabold text-black hover:bg-lime-300"
                >
                  Criar e atribuir treino agora
                </Link>
              </div>
            </div>
          </div>

          {/* Feed Concluídos */}
          <div className="lg:col-span-2 rounded-3xl border border-white/10 bg-white/5 overflow-hidden">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div>
                <p className="font-extrabold text-white">Últimos treinos concluídos</p>
                <p className="text-sm text-white/50">
                  Veja feedback e reaja rápido (nível premium Motion).
                </p>
              </div>
              {publicLink ? (
                <a
                  href={publicLink}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/80 hover:bg-white/10"
                >
                  Abrir meu perfil
                </a>
              ) : null}
            </div>

            <div className="p-5 space-y-3">
              {feed.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-white/70">
                  Nenhuma rotina concluída apareceu ainda.
                  <p className="mt-2 text-white/50 text-sm">
                    Se isso for inesperado, confira a policy de RLS de <b>aluno_rotina_conclusoes</b>.
                  </p>
                </div>
              ) : (
                feed.map((x) => {
                  const alunoNome = x.aluno?.nome_completo || "Aluno";
                  const rotNome = x.rotina?.nome || "Rotina";
                  const treinoNome = x.treino?.nome || "Treino";
                  const when = new Date(x.concluido_em).toLocaleString("pt-BR");

                  const alunoWa = x.aluno?.telefone
                    ? waLink(
                        x.aluno.telefone,
                        `Oi, ${alunoNome}! Vi que você concluiu "${rotNome}" (${treinoNome}) no Motion. Me conta como foi? 💪`
                      )
                    : null;

                  return (
                    <div key={x.id} className="rounded-2xl border border-white/10 bg-black/30 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-white font-extrabold truncate">
                            {alunoNome} <span className="text-white/50 font-bold">•</span>{" "}
                            <span className="text-lime-300">{rotNome}</span>
                          </p>
                          <p className="text-xs text-white/50 mt-1">
                            {treinoNome} • Concluído em {when}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {typeof x.feedback_nota === "number" ? (
                            <span className="rounded-full border border-lime-300/30 bg-lime-400/10 px-3 py-1 text-xs font-extrabold text-lime-300">
                              Nota {x.feedback_nota}/5
                            </span>
                          ) : (
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-white/60">
                              Sem nota
                            </span>
                          )}

                          {alunoWa ? (
                            <a
                              href={alunoWa}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-lime-300 hover:bg-white/10"
                            >
                              WhatsApp
                            </a>
                          ) : null}
                        </div>
                      </div>

                      {x.feedback_texto ? (
                        <div className="mt-3 rounded-2xl border border-white/10 bg-black/40 p-4 text-white/70 text-sm">
                          “{x.feedback_texto}”
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-white/50">
                          Sem comentário — você pode chamar no WhatsApp e pedir um feedback rápido.
                        </p>
                      )}
                    </div>
                  );
                })
              )}

              <div className="pt-2 flex flex-wrap gap-2">
                <Link
                  href="/professor/treinos"
                  className="rounded-2xl bg-lime-400 px-4 py-2 text-sm font-extrabold text-black hover:bg-lime-300"
                >
                  Atribuir novo plano
                </Link>

                <Link
                  href="/professor/perfil-publico"
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/80 hover:bg-white/10"
                >
                  Ajustar perfil público
                </Link>

                {publicLink ? (
                  <button
                    onClick={copyPublicLink}
                    className="rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-sm font-bold text-lime-300 hover:bg-white/5"
                  >
                    Copiar link “Treinar comigo”
                  </button>
                ) : (
                  <span className="text-sm text-white/50">
                    Configure seu <b>slug</b> no perfil público para gerar o link.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="mt-8 text-center text-xs text-white/40">
          Motion • Dashboard do Professor
        </div>
      </div>
    </main>
  );
}
