"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/utils/supabase-browser";

type ExercicioBase = {
  id: string;
  nome: string;
  descricao: string | null;
  link_youtube: string | null;
};

type TreinoExercicio = {
  id: string;
  ordem: number;
  series: number | null;
  repeticoes: string | null;
  carga: string | null;
  intervalo: string | null;
  observacoes: string | null;
  exercicios?: ExercicioBase | null;
  exercicios_catalogo?: ExercicioBase | null;
  exercicio_id?: string | null;
  catalogo_id?: string | null;
};

type Rotina = {
  id: string;
  nome: string;
  descricao: string | null;
  created_at: string;
  treino_exercicios: TreinoExercicio[];
};

type Treino = {
  id: string;
  nome: string;
  descricao: string | null;
  tipo_treino: string | null;
  objetivo: string | null;
  dificuldade: string | null;
  orientacao_professor: string | null;
  created_at: string;
  professor_id: string | null;
  rotinas_diarias: Rotina[];
};

type AlunoConclusao = {
  rotina_id: string;
  concluido_em: string;
  feedback_nota: number | null;
  feedback_texto: string | null;
};

type ProfessorMini = {
  id: string;
  nome_completo: string | null;
  telefone: string | null;
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
    <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-white/60 text-xs">
      {children}
    </span>
  );
}

function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200]">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#111] shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <p className="text-white font-bold">{title}</p>
            <button
              onClick={onClose}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-white/60 hover:bg-white/10 transition-colors"
            >
              ✕
            </button>
          </div>
          <div className="p-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

function getExercicio(e: TreinoExercicio): ExercicioBase | null {
  return e.exercicios || e.exercicios_catalogo || null;
}

export default function AlunoMeusTreinosPremium() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [treinos, setTreinos] = useState<Treino[]>([]);
  const [conclusoes, setConclusoes] = useState<Record<string, AlunoConclusao>>({});
  const [professor, setProfessor] = useState<ProfessorMini | null>(null);

  const [expandedTreinoId, setExpandedTreinoId] = useState<string | null>(null);
  const [expandedRotinaId, setExpandedRotinaId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [nota, setNota] = useState<number>(5);
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalErr, setModalErr] = useState<string | null>(null);

  const treinoAtual = useMemo(() => {
    if (!treinos.length) return null;
    return treinos[0];
  }, [treinos]);

  const rotinasOrdenadas = useMemo(() => {
    const r = treinoAtual?.rotinas_diarias || [];
    return [...r].sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
  }, [treinoAtual]);

  const rotinaDoDia = useMemo(() => {
    for (const r of rotinasOrdenadas) {
      if (!conclusoes[r.id]) return r;
    }
    return rotinasOrdenadas[0] || null;
  }, [rotinasOrdenadas, conclusoes]);

  const rotinaDoDiaConcluida = useMemo(() => {
    if (!rotinaDoDia) return false;
    return Boolean(conclusoes[rotinaDoDia.id]);
  }, [rotinaDoDia, conclusoes]);

  useEffect(() => {
    let mounted = true;

    async function boot() {
      setLoading(true);
      setError(null);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

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
        router.replace("/dashboard");
        return;
      }

      const { data: treinoData, error: treinoError } = await supabase
        .from("treinos")
        .select(`
          id,
          nome,
          descricao,
          tipo_treino,
          objetivo,
          dificuldade,
          orientacao_professor,
          created_at,
          professor_id,
          rotinas_diarias (
            id,
            nome,
            descricao,
            created_at,
            treino_exercicios (
              id,
              ordem,
              series,
              repeticoes,
              carga,
              intervalo,
              observacoes,
              exercicio_id,
              catalogo_id,
              exercicios (
                id,
                nome,
                descricao,
                link_youtube
              ),
              exercicios_catalogo (
                id,
                nome,
                descricao,
                link_youtube
              )
            )
          )
        `)
        .eq("aluno_id", user.id)
        .order("created_at", { ascending: false });

      if (!mounted) return;

      if (treinoError) {
        console.error("Erro ao carregar treinos:", treinoError.message);
        setError("Não foi possível carregar seus treinos: " + treinoError.message);
        setTreinos([]);
        setLoading(false);
        return;
      }

      const list = (treinoData as unknown as Treino[]) || [];
      setTreinos(list);

      if (list.length) {
        setExpandedTreinoId(list[0].id);
      }

      if (list.length) {
        const treinoAtualLocal = list[0];

        const { data: concl, error: conclErr } = await supabase
          .from("aluno_rotina_conclusoes")
          .select("rotina_id, concluido_em, feedback_nota, feedback_texto")
          .eq("aluno_id", user.id)
          .eq("treino_id", treinoAtualLocal.id);

        if (conclErr) {
          console.warn("Falha ao carregar conclusões:", conclErr.message);
          setConclusoes({});
        } else {
          const map: Record<string, AlunoConclusao> = {};
          (concl as any[] | null)?.forEach((c) => {
            map[c.rotina_id] = c;
          });
          setConclusoes(map);
        }

        if (treinoAtualLocal.professor_id) {
          const { data: prof, error: profErr } = await supabase
            .from("profiles")
            .select("id, nome_completo, telefone")
            .eq("id", treinoAtualLocal.professor_id)
            .single();

          if (!profErr && prof) setProfessor(prof as any);
        }
      } else {
        setConclusoes({});
        setProfessor(null);
      }

      setLoading(false);
    }

    boot();
    return () => {
      mounted = false;
    };
  }, [router]);

  function openTreinoDoDia() {
    if (!treinoAtual || !rotinaDoDia) return;
    setExpandedTreinoId(treinoAtual.id);
    setExpandedRotinaId(rotinaDoDia.id);
    setTimeout(() => {
      const el = document.getElementById("rotinas-anchor");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  async function concluirRotinaDoDia() {
    if (!treinoAtual || !rotinaDoDia) return;

    setSaving(true);
    setModalErr(null);

    const { data: { user } } = await supabase.auth.getUser();
    const alunoId = user?.id;
    if (!alunoId) {
      setModalErr("Sessão expirada. Faça login novamente.");
      setSaving(false);
      return;
    }

    const payload = {
      aluno_id: alunoId,
      treino_id: treinoAtual.id,
      rotina_id: rotinaDoDia.id,
      feedback_nota: nota,
      feedback_texto: feedback?.trim() || null,
    };

    const { error: insErr } = await supabase
      .from("aluno_rotina_conclusoes")
      .insert(payload);

    if (insErr) {
      console.error(insErr);
      setModalErr(insErr.message);
      setSaving(false);
      return;
    }

    setConclusoes((prev) => ({
      ...prev,
      [rotinaDoDia.id]: {
        rotina_id: rotinaDoDia.id,
        concluido_em: new Date().toISOString(),
        feedback_nota: nota,
        feedback_texto: feedback?.trim() || null,
      },
    }));

    setSaving(false);
    setModalOpen(false);
    setFeedback("");
    setNota(5);

    setTimeout(() => openTreinoDoDia(), 150);
  }

  const whatsappHref = useMemo(() => {
    const profNome = professor?.nome_completo || "Professor";
    const phone = professor?.telefone || "";
    if (!onlyDigits(phone)) return null;

    const rotNome = rotinaDoDia?.nome || "meu treino";
    const msg = `Olá, Prof. ${profNome}! Acabei de ver ${rotNome} no Motion. Pode me orientar em uma dúvida?`;
    return waLink(phone, msg);
  }, [professor, rotinaDoDia]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-white/40 text-sm">Carregando seus treinos…</p>
      </div>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white px-4 py-10">
        <div className="max-w-3xl mx-auto rounded-2xl border border-white/8 bg-white/[0.03] p-6">
          <p className="text-red-300">{error}</p>
          <div className="mt-4 flex gap-2">
            <Link
              href="/aluno/dashboard"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 transition-colors"
            >
              Voltar ao dashboard
            </Link>
            <button
              onClick={() => location.reload()}
              className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-black hover:bg-white/90 transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!treinos.length) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white px-4 py-8 pb-16">
        <div className="max-w-4xl mx-auto space-y-5">
          <div className="flex items-center gap-2 text-sm text-white/40">
            <Link href="/aluno/dashboard" className="hover:text-white/70 transition-colors">Dashboard</Link>
            <span>/</span>
            <span className="text-white/60">Meus Treinos</span>
          </div>

          <h1 className="text-2xl font-bold text-white">Meus Treinos</h1>

          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-8 text-center">
            <p className="text-white font-semibold">Seu professor ainda não enviou um treino.</p>
            <p className="mt-2 text-white/50 text-sm">
              Assim que ele atribuir um plano, ele vai aparecer aqui automaticamente.
            </p>

            <div className="mt-5 flex justify-center gap-3">
              <Link
                href="/aluno/dashboard"
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-black hover:bg-white/90 transition-colors"
              >
                Ir para o dashboard
              </Link>
              <Link
                href="/aluno/treinos-extras"
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/70 hover:bg-white/10 transition-colors"
              >
                Ver treinos extras
              </Link>
            </div>
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
          <span className="text-white/60">Meus Treinos</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Meus Treinos</h1>
            <p className="mt-1 text-white/50 text-sm">
              Seu plano atual, rotinas do dia e histórico de execução.
            </p>
          </div>
          <Link
            href="/aluno/treinos-extras"
            className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70 hover:bg-white/10 transition-colors"
          >
            Treinos extras
          </Link>
        </div>

        {/* Treino do dia */}
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
          <div className="flex flex-col lg:flex-row lg:items-start gap-6">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/40">Treino do dia</p>
              <h2 className="mt-1 text-xl font-bold text-white">
                {rotinaDoDia?.nome || "Sem rotina disponível"}
              </h2>

              {rotinaDoDia?.descricao ? (
                <p className="mt-2 text-white/60 text-sm">{rotinaDoDia.descricao}</p>
              ) : null}

              {rotinaDoDia && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Pill>Plano: {treinoAtual?.nome}</Pill>
                  <Pill>
                    Status:{" "}
                    {rotinaDoDiaConcluida ? (
                      <span className="text-white/80 font-semibold">Concluído</span>
                    ) : (
                      <span className="text-amber-300 font-semibold">Pendente</span>
                    )}
                  </Pill>
                  {treinoAtual?.dificuldade ? (
                    <Pill>Nível: {treinoAtual.dificuldade}</Pill>
                  ) : null}
                </div>
              )}

              {/* Preview exercícios */}
              {rotinaDoDia?.treino_exercicios?.length ? (
                <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4">
                  <p className="text-sm font-semibold text-white">Hoje você fará</p>
                  <ul className="mt-2 space-y-1 text-sm text-white/60">
                    {rotinaDoDia.treino_exercicios
                      .slice()
                      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
                      .slice(0, 4)
                      .map((e) => {
                        const ex = getExercicio(e);
                        return (
                          <li key={e.id}>
                            <span className="text-white/40 mr-2">{e.ordem}.</span>
                            {ex?.nome || "Exercício"}
                            <span className="text-white/40">
                              {" "}—{" "}
                              {[
                                e.series ? `${e.series} séries` : null,
                                e.repeticoes ? `${e.repeticoes}` : null,
                              ]
                                .filter(Boolean)
                                .join(" • ") || "detalhes no treino"}
                            </span>
                          </li>
                        );
                      })}
                  </ul>
                  {rotinaDoDia.treino_exercicios.length > 4 ? (
                    <p className="mt-2 text-xs text-white/40">
                      +{rotinaDoDia.treino_exercicios.length - 4} exercícios (veja na rotina)
                    </p>
                  ) : null}
                </div>
              ) : null}

              {treinoAtual?.orientacao_professor ? (
                <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4">
                  <p className="text-sm font-semibold text-white/70">Orientação do professor</p>
                  <p className="mt-1 text-sm text-white/60">{treinoAtual.orientacao_professor}</p>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 lg:w-52 shrink-0">
              <button
                onClick={openTreinoDoDia}
                className="rounded-xl bg-white px-4 py-3 text-sm font-bold text-black hover:bg-white/90 transition-colors"
              >
                Iniciar rotina
              </button>

              <button
                onClick={() => setModalOpen(true)}
                disabled={!rotinaDoDia || rotinaDoDiaConcluida}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/70 hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-white/5 transition-colors"
              >
                Marcar como concluído
              </button>

              {whatsappHref ? (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/60 hover:bg-white/10 text-center transition-colors"
                >
                  Chamar professor (WhatsApp)
                </a>
              ) : (
                <div className="rounded-xl border border-white/8 px-4 py-3 text-xs text-white/30 text-center">
                  WhatsApp indisponível
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Plano atual */}
        {treinoAtual ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
            <p className="text-xs text-white/40">Plano atual</p>
            <h2 className="mt-1 text-xl font-bold text-white">{treinoAtual.nome}</h2>
            {treinoAtual.descricao ? (
              <p className="mt-2 text-white/60 text-sm">{treinoAtual.descricao}</p>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              {treinoAtual.tipo_treino ? <Pill>{treinoAtual.tipo_treino}</Pill> : null}
              {treinoAtual.objetivo ? <Pill>Objetivo: {treinoAtual.objetivo}</Pill> : null}
              {treinoAtual.dificuldade ? <Pill>Nível: {treinoAtual.dificuldade}</Pill> : null}
            </div>
          </div>
        ) : null}

        <div id="rotinas-anchor" />

        {/* Accordion de treinos */}
        <div className="grid grid-cols-1 gap-3">
          {treinos.map((t) => {
            const openTreino = expandedTreinoId === t.id;

            return (
              <div key={t.id} className="rounded-2xl border border-white/8 bg-white/[0.03] overflow-hidden">
                <button
                  onClick={() => {
                    setExpandedTreinoId(openTreino ? null : t.id);
                    setExpandedRotinaId(null);
                  }}
                  className="w-full text-left p-5 hover:bg-white/5 transition flex items-center justify-between gap-4"
                >
                  <div>
                    <p className="font-semibold text-white">{t.nome}</p>
                    {t.descricao ? <p className="mt-0.5 text-sm text-white/50">{t.descricao}</p> : null}
                  </div>
                  <span className="text-white/40 shrink-0">{openTreino ? "−" : "+"}</span>
                </button>

                {openTreino ? (
                  <div className="px-5 pb-5">
                    <div className="grid grid-cols-1 gap-2">
                      {(t.rotinas_diarias || []).length === 0 ? (
                        <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-white/50 text-sm">
                          Este plano não possui rotinas cadastradas ainda.
                        </div>
                      ) : (
                        [...(t.rotinas_diarias || [])]
                          .sort((a, b) => (a.created_at > b.created_at ? 1 : -1))
                          .map((r) => {
                            const openRotina = expandedRotinaId === r.id;
                            const done = Boolean(conclusoes[r.id]);

                            return (
                              <div key={r.id} className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
                                <button
                                  onClick={() => setExpandedRotinaId(openRotina ? null : r.id)}
                                  className="w-full text-left px-4 py-3.5 hover:bg-white/5 transition flex items-center justify-between gap-4"
                                >
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="font-semibold text-white">{r.nome}</p>
                                      {done ? (
                                        <span className="text-xs text-white/70 border border-white/15 bg-white/10 px-2 py-0.5 rounded-full">
                                          Concluído
                                        </span>
                                      ) : (
                                        <span className="text-xs text-amber-300 border border-amber-300/20 bg-amber-300/10 px-2 py-0.5 rounded-full">
                                          Pendente
                                        </span>
                                      )}
                                    </div>
                                    {r.descricao ? (
                                      <p className="mt-0.5 text-sm text-white/50">{r.descricao}</p>
                                    ) : null}
                                    {done && conclusoes[r.id]?.concluido_em ? (
                                      <p className="mt-0.5 text-xs text-white/30">
                                        Concluído em:{" "}
                                        {new Date(conclusoes[r.id].concluido_em).toLocaleString()}
                                      </p>
                                    ) : null}
                                  </div>
                                  <span className="text-white/40 shrink-0">{openRotina ? "−" : "+"}</span>
                                </button>

                                {openRotina ? (
                                  <div className="px-4 pb-4">
                                    {(r.treino_exercicios || []).length === 0 ? (
                                      <div className="mt-2 rounded-xl border border-white/10 bg-black/40 p-4 text-white/50 text-sm">
                                        Nenhum exercício nesta rotina ainda.
                                      </div>
                                    ) : (
                                      <div className="mt-2 grid grid-cols-1 gap-2">
                                        {[...(r.treino_exercicios || [])]
                                          .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
                                          .map((e) => {
                                            const ex = getExercicio(e);

                                            return (
                                              <div key={e.id} className="rounded-xl border border-white/10 bg-black/40 p-4">
                                                <p className="font-semibold text-white">
                                                  <span className="text-white/40 mr-2">{e.ordem}.</span>
                                                  {ex?.nome || "Exercício"}
                                                </p>

                                                <p className="mt-1 text-sm text-white/50">
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
                                                  <p className="mt-1.5 text-sm text-white/50">{e.observacoes}</p>
                                                ) : null}

                                                {ex?.link_youtube ? (
                                                  <a
                                                    href={ex.link_youtube}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex mt-3 text-sm font-semibold text-white/60 hover:text-white hover:underline transition-colors"
                                                  >
                                                    Ver vídeo no YouTube ↗
                                                  </a>
                                                ) : null}
                                              </div>
                                            );
                                          })}
                                      </div>
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal conclusão */}
      <Modal
        open={modalOpen}
        title="Concluir treino do dia"
        onClose={() => {
          if (!saving) {
            setModalErr(null);
            setModalOpen(false);
          }
        }}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-white/50">Rotina</p>
            <p className="text-white font-bold text-lg">{rotinaDoDia?.nome || "-"}</p>
            {rotinaDoDiaConcluida ? (
              <p className="mt-2 text-white/60 text-sm font-semibold">
                Esta rotina já foi marcada como concluída.
              </p>
            ) : (
              <p className="mt-2 text-white/50 text-sm">
                Marque como concluída e deixe um feedback rápido para seu professor.
              </p>
            )}
          </div>

          <div>
            <label className="text-sm text-white/60 font-semibold">Nota (1 a 5)</label>
            <div className="mt-2 flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setNota(n)}
                  className={
                    "h-10 w-10 rounded-xl border border-white/10 font-bold text-sm " +
                    (nota === n ? "bg-white text-black" : "bg-white/5 text-white/60 hover:bg-white/10")
                  }
                  type="button"
                  disabled={saving || rotinaDoDiaConcluida}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-white/60 font-semibold">Feedback (opcional)</label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="mt-2 w-full min-h-[100px] rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-white/25 transition-colors resize-none"
              placeholder="Ex: senti dificuldade no exercício 3, carga ficou leve, etc."
              disabled={saving || rotinaDoDiaConcluida}
            />
          </div>

          {modalErr ? <p className="text-red-300 text-sm">{modalErr}</p> : null}

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                if (!saving) {
                  setModalErr(null);
                  setModalOpen(false);
                }
              }}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70 hover:bg-white/10 transition-colors"
              disabled={saving}
              type="button"
            >
              Cancelar
            </button>

            <button
              onClick={concluirRotinaDoDia}
              disabled={saving || !rotinaDoDia || rotinaDoDiaConcluida}
              className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-black hover:bg-white/90 disabled:opacity-40 transition-colors"
              type="button"
            >
              {saving ? "Salvando…" : "Concluir"}
            </button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
