"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/utils/supabase-browser";

interface Exercicio {
  id: string;
  nome: string;
  descricao: string | null;
  link_youtube: string | null;
  professor_id: string;
}

// -----------------------------
// Helpers
// -----------------------------
function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getYouTubeId(url: string | null | undefined) {
  if (!url) return null;
  try {
    const u = new URL(url);
    // youtu.be/ID
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace("/", "").trim();
      return id || null;
    }
    // youtube.com/watch?v=ID
    const v = u.searchParams.get("v");
    if (v) return v;
    // youtube.com/shorts/ID or /embed/ID
    const parts = u.pathname.split("/").filter(Boolean);
    const shortsIndex = parts.indexOf("shorts");
    if (shortsIndex >= 0 && parts[shortsIndex + 1]) return parts[shortsIndex + 1];
    const embedIndex = parts.indexOf("embed");
    if (embedIndex >= 0 && parts[embedIndex + 1]) return parts[embedIndex + 1];
    return null;
  } catch {
    return null;
  }
}

function validateYoutubeUrl(url: string) {
  if (!url.trim()) return true;
  const id = getYouTubeId(url.trim());
  return Boolean(id);
}

// -----------------------------
// Tiny Toast (premium feel, no libs)
// -----------------------------
type ToastType = "success" | "error" | "info";
function Toast({
  open,
  type,
  title,
  message,
  onClose,
}: {
  open: boolean;
  type: ToastType;
  title: string;
  message?: string;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed bottom-5 right-5 z-[9999] w-[92vw] max-w-sm">
      <div
        className={cx(
          "rounded-2xl border p-4 shadow-[0_25px_80px_rgba(0,0,0,0.65)] backdrop-blur-md",
          "bg-black/55",
          type === "success" && "border-lime-400/30",
          type === "error" && "border-red-400/30",
          type === "info" && "border-white/10"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p
              className={cx(
                "text-sm font-extrabold",
                type === "success" && "text-lime-300",
                type === "error" && "text-red-200",
                type === "info" && "text-white"
              )}
            >
              {title}
            </p>
            {message ? <p className="mt-1 text-xs text-white/70 leading-relaxed">{message}</p> : null}
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-bold text-white/70 hover:bg-white/10"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------
// Modal
// -----------------------------
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
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-xl rounded-3xl border border-white/10 bg-gray-950/90 p-6 shadow-[0_25px_90px_rgba(0,0,0,0.75)] backdrop-blur-md">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-white/50">Motion • Biblioteca</p>
            <h2 className="mt-1 text-xl font-extrabold text-white">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/80 hover:bg-white/10"
          >
            Fechar
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

// -----------------------------
// Page
// -----------------------------
export default function BibliotecaExerciciosPage() {
  const router = useRouter();

  const [professorId, setProfessorId] = useState<string | null>(null);
  const [exercicios, setExercicios] = useState<Exercicio[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [query, setQuery] = useState("");
  const [onlyWithVideo, setOnlyWithVideo] = useState(false);
  const [sort, setSort] = useState<"az" | "za">("az");
  const [expandedVideo, setExpandedVideo] = useState<Record<string, boolean>>({});

  // modal add/edit
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentExercicio, setCurrentExercicio] = useState<Exercicio | null>(null);

  // form add
  const [novoExercicioNome, setNovoExercicioNome] = useState("");
  const [novoExercicioDescricao, setNovoExercicioDescricao] = useState("");
  const [novoExercicioLinkYoutube, setNovoExercicioLinkYoutube] = useState("");

  // form edit
  const [editNome, setEditNome] = useState("");
  const [editDescricao, setEditDescricao] = useState("");
  const [editLinkYoutube, setEditLinkYoutube] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  // toast
  const [toastOpen, setToastOpen] = useState(false);
  const [toastType, setToastType] = useState<ToastType>("info");
  const [toastTitle, setToastTitle] = useState("");
  const [toastMsg, setToastMsg] = useState<string | undefined>(undefined);

  function fireToast(type: ToastType, title: string, message?: string) {
    setToastType(type);
    setToastTitle(title);
    setToastMsg(message);
    setToastOpen(true);
    window.setTimeout(() => setToastOpen(false), 3500);
  }

  // -----------------------------
  // Auth + fetch
  // -----------------------------
  useEffect(() => {
    let mounted = true;

    async function boot() {
      setLoading(true);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push("/login");
        return;
      }

      // role check
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!mounted) return;

      if (profileError || profileData?.role !== "professor") {
        fireToast("error", "Acesso negado", "Esta página é apenas para professores.");
        router.push("/dashboard");
        setLoading(false);
        return;
      }

      setProfessorId(user.id);

      const { data: exerciciosData, error: exerciciosError } = await supabase
        .from("exercicios")
        .select("*")
        .eq("professor_id", user.id);

      if (!mounted) return;

      if (exerciciosError) {
        fireToast("error", "Erro ao carregar", "Não foi possível carregar a biblioteca.");
        setExercicios([]);
        setLoading(false);
        return;
      }

      setExercicios((exerciciosData || []) as Exercicio[]);
      setLoading(false);
    }

    boot();
    return () => {
      mounted = false;
    };
  }, [router]);

  // -----------------------------
  // Derived
  // -----------------------------
  const total = exercicios.length;
  const comVideo = useMemo(() => exercicios.filter((e) => !!getYouTubeId(e.link_youtube)).length, [exercicios]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    let list = exercicios.slice();

    if (q) {
      list = list.filter((e) => {
        const nome = (e.nome || "").toLowerCase();
        const desc = (e.descricao || "").toLowerCase();
        return nome.includes(q) || desc.includes(q);
      });
    }

    if (onlyWithVideo) {
      list = list.filter((e) => !!getYouTubeId(e.link_youtube));
    }

    list.sort((a, b) => {
      const an = (a.nome || "").toLowerCase();
      const bn = (b.nome || "").toLowerCase();
      const cmp = an.localeCompare(bn);
      return sort === "az" ? cmp : -cmp;
    });

    return list;
  }, [exercicios, query, onlyWithVideo, sort]);

  // -----------------------------
  // CRUD
  // -----------------------------
  async function refreshList() {
    if (!professorId) return;
    const { data, error } = await supabase
      .from("exercicios")
      .select("*")
      .eq("professor_id", professorId);

    if (error) {
      fireToast("error", "Erro", "Não consegui atualizar a lista.");
      return;
    }
    setExercicios((data || []) as Exercicio[]);
  }

  const handleAddExercicio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!professorId) {
      fireToast("error", "Sessão", "ID do professor não encontrado. Faça login novamente.");
      return;
    }

    if (!novoExercicioNome.trim()) {
      fireToast("error", "Campo obrigatório", "Informe o nome do exercício.");
      return;
    }

    if (!validateYoutubeUrl(novoExercicioLinkYoutube)) {
      fireToast("error", "Link inválido", "Cole um link válido do YouTube (watch, shorts ou youtu.be).");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error: insertError } = await supabase
        .from("exercicios")
        .insert({
          nome: novoExercicioNome.trim(),
          descricao: novoExercicioDescricao.trim() || null,
          link_youtube: novoExercicioLinkYoutube.trim() || null,
          professor_id: professorId,
        })
        .select()
        .single();

      if (insertError) {
        if ((insertError as any).code === "23505") {
          fireToast("error", "Nome repetido", "Já existe um exercício com este nome. Use outro.");
        } else {
          fireToast("error", "Erro ao adicionar", insertError.message);
        }
        return;
      }

      setExercicios((prev) => [data as Exercicio, ...prev]);
      setNovoExercicioNome("");
      setNovoExercicioDescricao("");
      setNovoExercicioLinkYoutube("");
      setShowAddModal(false);
      fireToast("success", "Exercício criado", "Já está disponível para usar nos treinos.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (exercicio: Exercicio) => {
    setCurrentExercicio(exercicio);
    setEditNome(exercicio.nome);
    setEditDescricao(exercicio.descricao || "");
    setEditLinkYoutube(exercicio.link_youtube || "");
    setShowEditModal(true);
  };

  const handleUpdateExercicio = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentExercicio) return;
    if (!professorId) return;

    if (!editNome.trim()) {
      fireToast("error", "Campo obrigatório", "Informe o nome do exercício.");
      return;
    }

    if (!validateYoutubeUrl(editLinkYoutube)) {
      fireToast("error", "Link inválido", "Cole um link válido do YouTube (watch, shorts ou youtu.be).");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error: updateError } = await supabase
        .from("exercicios")
        .update({
          nome: editNome.trim(),
          descricao: editDescricao.trim() || null,
          link_youtube: editLinkYoutube.trim() || null,
        })
        .eq("id", currentExercicio.id)
        .eq("professor_id", professorId)
        .select()
        .single();

      if (updateError) {
        if ((updateError as any).code === "23505") {
          fireToast("error", "Nome repetido", "Já existe outro exercício com este nome. Use outro.");
        } else {
          fireToast("error", "Erro ao atualizar", updateError.message);
        }
        return;
      }

      setExercicios((prev) => prev.map((ex) => (ex.id === (data as Exercicio).id ? (data as Exercicio) : ex)));
      setShowEditModal(false);
      setCurrentExercicio(null);
      fireToast("success", "Atualizado", "Exercício atualizado com sucesso.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExercicio = async (exercicioId: string) => {
    if (!professorId) return;

    const ok = confirm("Tem certeza que deseja deletar este exercício? Isso pode afetar treinos que o utilizam.");
    if (!ok) return;

    setIsSubmitting(true);
    try {
      const { error: deleteError } = await supabase
        .from("exercicios")
        .delete()
        .eq("id", exercicioId)
        .eq("professor_id", professorId);

      if (deleteError) {
        fireToast("error", "Erro ao deletar", deleteError.message);
        return;
      }

      setExercicios((prev) => prev.filter((ex) => ex.id !== exercicioId));
      fireToast("success", "Deletado", "Exercício removido da sua biblioteca.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // -----------------------------
  // UI
  // -----------------------------
  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 text-white px-4 py-10">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl">
            <div className="h-6 w-56 rounded bg-white/10" />
            <div className="mt-3 h-4 w-80 rounded bg-white/10" />
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="h-24 rounded-3xl border border-white/10 bg-black/30" />
              <div className="h-24 rounded-3xl border border-white/10 bg-black/30" />
              <div className="h-24 rounded-3xl border border-white/10 bg-black/30" />
            </div>
            <div className="mt-6 grid gap-3">
              <div className="h-20 rounded-3xl border border-white/10 bg-black/30" />
              <div className="h-20 rounded-3xl border border-white/10 bg-black/30" />
              <div className="h-20 rounded-3xl border border-white/10 bg-black/30" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-10">
      <Toast open={toastOpen} type={toastType} title={toastTitle} message={toastMsg} onClose={() => setToastOpen(false)} />

      <div className="mx-auto max-w-6xl">
        {/* HERO / HEADER */}
        <div className="rounded-[2rem] border border-white/10 bg-white/5 overflow-hidden shadow-2xl">
          <div className="relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(163,230,53,0.12),rgba(0,0,0,0.0)_55%)]" />
            <div className="absolute inset-0 bg-gradient-to-br from-black/10 via-black/45 to-black/70" />

            <div className="relative p-6 md:p-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/70">
                    <span className="h-2 w-2 rounded-full bg-lime-400" />
                    Motion • Biblioteca de Exercícios
                  </div>
                  <h1 className="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight">
                    Sua biblioteca, <span className="text-lime-300">do seu jeito</span>
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm text-white/70 leading-relaxed">
                    Crie exercícios com nomes regionais, adicione descrição e link do YouTube — e reutilize nos treinos e rotinas com rapidez.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/professor/dashboard"
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/80 hover:bg-white/10"
                  >
                    ← Voltar ao Dashboard
                  </Link>

                  <button
                    onClick={() => setShowAddModal(true)}
                    className="rounded-2xl bg-lime-400 px-4 py-2 text-sm font-extrabold text-black hover:bg-lime-300 disabled:opacity-60"
                    disabled={isSubmitting}
                  >
                    + Novo exercício
                  </button>

                  <button
                    onClick={refreshList}
                    className="rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-sm font-bold text-lime-300 hover:bg-white/5 disabled:opacity-60"
                    disabled={isSubmitting}
                  >
                    Atualizar
                  </button>
                </div>
              </div>

              {/* STATS */}
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
                  <p className="text-xs text-white/60">Total de exercícios</p>
                  <p className="mt-2 text-3xl font-extrabold text-white">{total}</p>
                  <p className="mt-2 text-xs text-white/40">Disponíveis para usar em treinos</p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
                  <p className="text-xs text-white/60">Com vídeo</p>
                  <p className="mt-2 text-3xl font-extrabold text-white">{comVideo}</p>
                  <p className="mt-2 text-xs text-white/40">Preview direto (YouTube)</p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
                  <p className="text-xs text-white/60">Dica premium</p>
                  <p className="mt-2 text-sm text-white/75 leading-relaxed">
                    Use descrições curtas e objetivas. Seu aluno entende rápido e você reduz mensagens repetidas.
                  </p>
                  <div className="mt-3 inline-flex rounded-full border border-lime-300/20 bg-lime-400/10 px-3 py-1 text-xs font-bold text-lime-300">
                    UX de produto grande
                  </div>
                </div>
              </div>

              {/* CONTROLS */}
              <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex-1">
                  <label className="text-xs text-white/50">Buscar</label>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Digite nome ou descrição…"
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-lime-300/40"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setOnlyWithVideo((v) => !v)}
                    className={cx(
                      "rounded-2xl border px-4 py-3 text-sm font-bold transition",
                      onlyWithVideo
                        ? "border-lime-300/30 bg-lime-400/10 text-lime-300"
                        : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
                    )}
                  >
                    {onlyWithVideo ? "Só com vídeo ✓" : "Só com vídeo"}
                  </button>

                  <button
                    onClick={() => setSort((s) => (s === "az" ? "za" : "az"))}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white/75 hover:bg-white/10"
                  >
                    Ordenar: {sort === "az" ? "A → Z" : "Z → A"}
                  </button>

                  <button
                    onClick={() => {
                      setQuery("");
                      setOnlyWithVideo(false);
                      setSort("az");
                    }}
                    className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold text-white/70 hover:bg-white/5"
                  >
                    Limpar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* LIST */}
        <div className="mt-6">
          {filtered.length === 0 ? (
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-10 text-center shadow-2xl">
              <p className="text-xl font-extrabold text-white">Nada por aqui…</p>
              <p className="mt-2 text-sm text-white/60">
                {total === 0
                  ? "Crie seu primeiro exercício e comece a montar treinos reutilizáveis."
                  : "Tente ajustar a busca ou os filtros."}
              </p>
              <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
                <button
                  onClick={() => setShowAddModal(true)}
                  className="rounded-full bg-lime-400 px-6 py-3 text-sm font-extrabold text-black hover:bg-lime-300"
                >
                  + Criar exercício
                </button>
                <button
                  onClick={() => {
                    setQuery("");
                    setOnlyWithVideo(false);
                    setSort("az");
                  }}
                  className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-bold text-white/80 hover:bg-white/10"
                >
                  Limpar filtros
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              {filtered.map((ex) => {
                const yid = getYouTubeId(ex.link_youtube);
                const isOpen = !!expandedVideo[ex.id];

                return (
                  <div
                    key={ex.id}
                    className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 shadow-[0_25px_80px_rgba(0,0,0,0.50)]"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-extrabold text-white truncate">{ex.nome}</p>

                          {yid ? (
                            <span className="rounded-full border border-lime-300/25 bg-lime-400/10 px-3 py-1 text-xs font-bold text-lime-300">
                              Vídeo
                            </span>
                          ) : (
                            <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-bold text-white/60">
                              Sem vídeo
                            </span>
                          )}
                        </div>

                        {ex.descricao ? (
                          <p className="mt-2 text-sm text-white/70 leading-relaxed">{ex.descricao}</p>
                        ) : (
                          <p className="mt-2 text-sm text-white/40 italic">Sem descrição.</p>
                        )}

                        <div className="mt-3 flex flex-wrap gap-2">
                          {ex.link_youtube ? (
                            <a
                              href={ex.link_youtube}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-xs font-bold text-white/80 hover:bg-white/5"
                            >
                              Abrir no YouTube →
                            </a>
                          ) : null}

                          {yid ? (
                            <button
                              onClick={() =>
                                setExpandedVideo((prev) => ({ ...prev, [ex.id]: !prev[ex.id] }))
                              }
                              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-lime-300 hover:bg-white/10"
                            >
                              {isOpen ? "Ocultar preview" : "Ver preview"}
                            </button>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => openEditModal(ex)}
                          disabled={isSubmitting}
                          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/80 hover:bg-white/10 disabled:opacity-60"
                        >
                          Editar
                        </button>

                        <button
                          onClick={() => handleDeleteExercicio(ex.id)}
                          disabled={isSubmitting}
                          className="rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-200 hover:bg-red-500/15 disabled:opacity-60"
                        >
                          Deletar
                        </button>
                      </div>
                    </div>

                    {yid && isOpen ? (
                      <div className="mt-4 overflow-hidden rounded-3xl border border-white/10 bg-black/40">
                        <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
                          <iframe
                            className="absolute inset-0 h-full w-full"
                            src={`https://www.youtube.com/embed/${yid}`}
                            title={`YouTube preview - ${ex.nome}`}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* FOOT */}
        <div className="mt-8 text-center text-xs text-white/40">Motion • Biblioteca Premium</div>
      </div>

      {/* ADD MODAL */}
      <Modal open={showAddModal} title="Adicionar novo exercício" onClose={() => setShowAddModal(false)}>
        <form onSubmit={handleAddExercicio} className="space-y-4">
          <div>
            <label className="text-xs text-white/60">Nome do exercício *</label>
            <input
              value={novoExercicioNome}
              onChange={(e) => setNovoExercicioNome(e.target.value)}
              placeholder="Ex: Agachamento Livre"
              className="mt-1 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-lime-300/40"
              required
            />
          </div>

          <div>
            <label className="text-xs text-white/60">Descrição (opcional)</label>
            <textarea
              value={novoExercicioDescricao}
              onChange={(e) => setNovoExercicioDescricao(e.target.value)}
              placeholder="Ex: Mantenha coluna neutra, joelhos alinhados..."
              rows={4}
              className="mt-1 w-full resize-none rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-lime-300/40"
            />
          </div>

          <div>
            <label className="text-xs text-white/60">Link do YouTube (opcional)</label>
            <input
              value={novoExercicioLinkYoutube}
              onChange={(e) => setNovoExercicioLinkYoutube(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="mt-1 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-lime-300/40"
            />
            <p className="mt-2 text-xs text-white/45">
              Aceita: <span className="text-white/70">watch</span>, <span className="text-white/70">shorts</span> ou{" "}
              <span className="text-white/70">youtu.be</span>.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white/80 hover:bg-white/10"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-2xl bg-lime-400 px-4 py-3 text-sm font-extrabold text-black hover:bg-lime-300 disabled:opacity-60"
            >
              {isSubmitting ? "Salvando..." : "Salvar exercício"}
            </button>
          </div>
        </form>
      </Modal>

      {/* EDIT MODAL */}
      <Modal
        open={showEditModal && !!currentExercicio}
        title="Editar exercício"
        onClose={() => {
          setShowEditModal(false);
          setCurrentExercicio(null);
        }}
      >
        <form onSubmit={handleUpdateExercicio} className="space-y-4">
          <div>
            <label className="text-xs text-white/60">Nome do exercício *</label>
            <input
              value={editNome}
              onChange={(e) => setEditNome(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-lime-300/40"
              required
            />
          </div>

          <div>
            <label className="text-xs text-white/60">Descrição (opcional)</label>
            <textarea
              value={editDescricao}
              onChange={(e) => setEditDescricao(e.target.value)}
              rows={4}
              className="mt-1 w-full resize-none rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-lime-300/40"
            />
          </div>

          <div>
            <label className="text-xs text-white/60">Link do YouTube (opcional)</label>
            <input
              value={editLinkYoutube}
              onChange={(e) => setEditLinkYoutube(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-lime-300/40"
            />
            {editLinkYoutube?.trim() ? (
              <p className="mt-2 text-xs text-white/45">
                Preview:{" "}
                {getYouTubeId(editLinkYoutube) ? (
                  <span className="text-lime-300 font-bold">OK</span>
                ) : (
                  <span className="text-red-200 font-bold">link não reconhecido</span>
                )}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => {
                setShowEditModal(false);
                setCurrentExercicio(null);
              }}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white/80 hover:bg-white/10"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-2xl bg-lime-400 px-4 py-3 text-sm font-extrabold text-black hover:bg-lime-300 disabled:opacity-60"
            >
              {isSubmitting ? "Atualizando..." : "Salvar alterações"}
            </button>
          </div>
        </form>
      </Modal>
    </main>
  );
}