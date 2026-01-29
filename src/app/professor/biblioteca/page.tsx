// src/app/professor/biblioteca/page.tsx
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

interface ExercicioCatalogo {
  id: string;
  nome: string;
  categoria: string | null;
  subcategoria: string | null;
  grupo_muscular: string | null;
  musculo_principal: string | null;
  musculos_secundarios: string | null;
  objetivo: string | null;
  equipamento: string | null;
  ambiente: string | null;
  nivel: string | null;
  descricao_tecnica: string | null;
  link_video: string | null;
}

// -----------------------------
// Helpers
// -----------------------------
function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function safeLower(s: string | null | undefined) {
  return (s || "").toLowerCase();
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

function uniqSorted(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((v) => (v || "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
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
  subtitle,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
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
            {subtitle ? <p className="mt-1 text-xs text-white/60">{subtitle}</p> : null}
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

  // Tabs
  const [tab, setTab] = useState<"minha" | "catalogo">("minha");

  // Minha biblioteca
  const [exercicios, setExercicios] = useState<Exercicio[]>([]);
  const [expandedVideoMine, setExpandedVideoMine] = useState<Record<string, boolean>>({});

  // Catálogo
  const [catalogo, setCatalogo] = useState<ExercicioCatalogo[]>([]);
  const [expandedVideoCat, setExpandedVideoCat] = useState<Record<string, boolean>>({});
  const [selectedCatalog, setSelectedCatalog] = useState<Record<string, boolean>>({});

  // Loading
  const [loading, setLoading] = useState(true);
  const [loadingCatalogo, setLoadingCatalogo] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // UI: Minha
  const [queryMine, setQueryMine] = useState("");
  const [onlyWithVideoMine, setOnlyWithVideoMine] = useState(false);
  const [sortMine, setSortMine] = useState<"az" | "za">("az");

  // UI: Catálogo
  const [queryCat, setQueryCat] = useState("");
  const [onlyWithVideoCat, setOnlyWithVideoCat] = useState(false);
  const [sortCat, setSortCat] = useState<"az" | "za">("az");
  const [filterCategoria, setFilterCategoria] = useState("");
  const [filterGrupo, setFilterGrupo] = useState("");
  const [filterEquip, setFilterEquip] = useState("");
  const [filterNivel, setFilterNivel] = useState("");

  // modal add/edit (Minha)
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
  // Auth + fetch Minha
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
        fireToast("error", "Erro ao carregar", "Não foi possível carregar sua biblioteca.");
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
  // Fetch Catálogo (lazy)
  // -----------------------------
  async function fetchCatalogo() {
    setLoadingCatalogo(true);

    const { data, error } = await supabase
      .from("exercicios_catalogo")
      .select("*")
      .order("categoria", { ascending: true })
      .order("nome", { ascending: true });

    if (error) {
      fireToast("error", "Erro ao carregar catálogo", error.message);
      setCatalogo([]);
      setLoadingCatalogo(false);
      return;
    }

    setCatalogo((data || []) as ExercicioCatalogo[]);
    setLoadingCatalogo(false);
  }

  useEffect(() => {
    if (tab !== "catalogo") return;
    if (catalogo.length > 0) return;
    fetchCatalogo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // -----------------------------
  // Derived - Minha
  // -----------------------------
  const totalMine = exercicios.length;
  const comVideoMine = useMemo(
    () => exercicios.filter((e) => !!getYouTubeId(e.link_youtube)).length,
    [exercicios]
  );

  const filteredMine = useMemo(() => {
    const q = queryMine.trim().toLowerCase();

    let list = exercicios.slice();

    if (q) {
      list = list.filter((e) => {
        const nome = safeLower(e.nome);
        const desc = safeLower(e.descricao);
        return nome.includes(q) || desc.includes(q);
      });
    }

    if (onlyWithVideoMine) {
      list = list.filter((e) => !!getYouTubeId(e.link_youtube));
    }

    list.sort((a, b) => {
      const an = safeLower(a.nome);
      const bn = safeLower(b.nome);
      const cmp = an.localeCompare(bn);
      return sortMine === "az" ? cmp : -cmp;
    });

    return list;
  }, [exercicios, queryMine, onlyWithVideoMine, sortMine]);

  // -----------------------------
  // Derived - Catálogo
  // -----------------------------
  const totalCat = catalogo.length;
  const comVideoCat = useMemo(
    () => catalogo.filter((c) => !!getYouTubeId(c.link_video)).length,
    [catalogo]
  );

  const categorias = useMemo(() => uniqSorted(catalogo.map((c) => c.categoria)), [catalogo]);
  const grupos = useMemo(() => uniqSorted(catalogo.map((c) => c.grupo_muscular)), [catalogo]);
  const equips = useMemo(() => uniqSorted(catalogo.map((c) => c.equipamento)), [catalogo]);
  const niveis = useMemo(() => uniqSorted(catalogo.map((c) => c.nivel)), [catalogo]);

  const filteredCat = useMemo(() => {
    const q = queryCat.trim().toLowerCase();

    let list = catalogo.slice();

    if (q) {
      list = list.filter((c) => {
        const blob = [
          c.nome,
          c.categoria,
          c.subcategoria,
          c.grupo_muscular,
          c.musculo_principal,
          c.musculos_secundarios,
          c.objetivo,
          c.equipamento,
          c.ambiente,
          c.nivel,
          c.descricao_tecnica,
        ]
          .map((x) => (x || "").toLowerCase())
          .join(" • ");
        return blob.includes(q);
      });
    }

    if (filterCategoria) list = list.filter((c) => (c.categoria || "") === filterCategoria);
    if (filterGrupo) list = list.filter((c) => (c.grupo_muscular || "") === filterGrupo);
    if (filterEquip) list = list.filter((c) => (c.equipamento || "") === filterEquip);
    if (filterNivel) list = list.filter((c) => (c.nivel || "") === filterNivel);

    if (onlyWithVideoCat) {
      list = list.filter((c) => !!getYouTubeId(c.link_video));
    }

    list.sort((a, b) => {
      const an = safeLower(a.nome);
      const bn = safeLower(b.nome);
      const cmp = an.localeCompare(bn);
      return sortCat === "az" ? cmp : -cmp;
    });

    return list;
  }, [catalogo, queryCat, filterCategoria, filterGrupo, filterEquip, filterNivel, onlyWithVideoCat, sortCat]);

  const selectedCount = useMemo(
    () => Object.values(selectedCatalog).filter(Boolean).length,
    [selectedCatalog]
  );

  // -----------------------------
  // CRUD - Minha
  // -----------------------------
  async function refreshMine() {
    if (!professorId) return;
    const { data, error } = await supabase.from("exercicios").select("*").eq("professor_id", professorId);

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
  // Catálogo -> Minha (import)
  // -----------------------------
  async function addFromCatalog(item: ExercicioCatalogo) {
    if (!professorId) {
      fireToast("error", "Sessão", "Faça login novamente.");
      return;
    }

    setIsSubmitting(true);

    try {
      const exists = exercicios.some(
        (e) => safeLower(e.nome).trim() === safeLower(item.nome).trim()
      );

      if (exists) {
        fireToast("info", "Já existe", "Você já tem esse exercício na sua biblioteca.");
        return;
      }

      const { data, error } = await supabase
        .from("exercicios")
        .insert({
          nome: item.nome,
          descricao: item.descricao_tecnica || null,
          link_youtube: item.link_video || null,
          professor_id: professorId,
        })
        .select()
        .single();

      if (error) {
        fireToast("error", "Erro ao adicionar", error.message);
        return;
      }

      setExercicios((prev) => [data as Exercicio, ...prev]);
      fireToast("success", "Adicionado", "O exercício já está na sua biblioteca.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function importSelected() {
    if (!professorId) {
      fireToast("error", "Sessão", "Faça login novamente.");
      return;
    }

    const ids = Object.entries(selectedCatalog)
      .filter(([, v]) => v)
      .map(([id]) => id);

    if (ids.length === 0) {
      fireToast("info", "Seleção vazia", "Selecione pelo menos 1 exercício para importar.");
      return;
    }

    const items = catalogo.filter((c) => ids.includes(c.id));
    if (items.length === 0) {
      fireToast("info", "Nada encontrado", "Não encontrei itens para importar.");
      return;
    }

    setIsSubmitting(true);
    try {
      const mineNames = new Set(exercicios.map((e) => safeLower(e.nome).trim()));
      const toInsert = items
        .filter((c) => !mineNames.has(safeLower(c.nome).trim()))
        .map((c) => ({
          nome: c.nome,
          descricao: c.descricao_tecnica || null,
          link_youtube: c.link_video || null,
          professor_id: professorId,
        }));

      if (toInsert.length === 0) {
        fireToast("info", "Já existe", "Todos os selecionados já estão na sua biblioteca.");
        return;
      }

      const { data, error } = await supabase.from("exercicios").insert(toInsert).select();

      if (error) {
        fireToast("error", "Erro ao importar", error.message);
        return;
      }

      const inserted = (data || []) as Exercicio[];
      setExercicios((prev) => [...inserted, ...prev]);

      // limpa seleção
      setSelectedCatalog({});
      fireToast("success", "Importação concluída", `${inserted.length} exercício(s) importado(s).`);
    } finally {
      setIsSubmitting(false);
    }
  }

  // -----------------------------
  // UI - Loading skeleton
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

  // -----------------------------
  // UI - Page
  // -----------------------------
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
                    Biblioteca <span className="text-lime-300">Premium</span>
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm text-white/70 leading-relaxed">
                    Use sua biblioteca própria ou copie do catálogo global premium. Você mantém liberdade total e ganha velocidade de montagem.
                  </p>

                  {/* Tabs */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setTab("minha")}
                      className={cx(
                        "rounded-2xl px-4 py-2 text-sm font-extrabold border transition",
                        tab === "minha"
                          ? "bg-lime-400 text-black border-lime-300/40"
                          : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
                      )}
                    >
                      Minha biblioteca
                    </button>

                    <button
                      type="button"
                      onClick={() => setTab("catalogo")}
                      className={cx(
                        "rounded-2xl px-4 py-2 text-sm font-extrabold border transition",
                        tab === "catalogo"
                          ? "bg-lime-400 text-black border-lime-300/40"
                          : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
                      )}
                    >
                      Catálogo Premium
                    </button>

                    {tab === "catalogo" ? (
                      <span className="inline-flex items-center rounded-full border border-lime-300/20 bg-lime-400/10 px-3 py-1 text-xs font-bold text-lime-300">
                        {totalCat} itens • {comVideoCat} com vídeo
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-lime-300/20 bg-lime-400/10 px-3 py-1 text-xs font-bold text-lime-300">
                        {totalMine} itens • {comVideoMine} com vídeo
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/professor/dashboard"
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/80 hover:bg-white/10"
                  >
                    ← Voltar ao Dashboard
                  </Link>

                  {tab === "minha" ? (
                    <>
                      <button
                        onClick={() => setShowAddModal(true)}
                        className="rounded-2xl bg-lime-400 px-4 py-2 text-sm font-extrabold text-black hover:bg-lime-300 disabled:opacity-60"
                        disabled={isSubmitting}
                      >
                        + Novo exercício
                      </button>

                      <button
                        onClick={refreshMine}
                        className="rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-sm font-bold text-lime-300 hover:bg-white/5 disabled:opacity-60"
                        disabled={isSubmitting}
                      >
                        Atualizar
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={fetchCatalogo}
                        className="rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-sm font-bold text-lime-300 hover:bg-white/5 disabled:opacity-60"
                        disabled={isSubmitting || loadingCatalogo}
                      >
                        {loadingCatalogo ? "Atualizando..." : "Atualizar catálogo"}
                      </button>

                      <button
                        onClick={importSelected}
                        className="rounded-2xl bg-lime-400 px-4 py-2 text-sm font-extrabold text-black hover:bg-lime-300 disabled:opacity-60"
                        disabled={isSubmitting || selectedCount === 0}
                        title={selectedCount === 0 ? "Selecione exercícios para importar" : undefined}
                      >
                        Importar selecionados ({selectedCount})
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* STATS */}
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
                  <p className="text-xs text-white/60">{tab === "minha" ? "Total na sua biblioteca" : "Total no catálogo"}</p>
                  <p className="mt-2 text-3xl font-extrabold text-white">{tab === "minha" ? totalMine : totalCat}</p>
                  <p className="mt-2 text-xs text-white/40">{tab === "minha" ? "Seus exercícios para usar em treinos" : "Exercícios premium prontos para copiar"}</p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
                  <p className="text-xs text-white/60">Com vídeo</p>
                  <p className="mt-2 text-3xl font-extrabold text-white">{tab === "minha" ? comVideoMine : comVideoCat}</p>
                  <p className="mt-2 text-xs text-white/40">Preview direto (YouTube)</p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
                  <p className="text-xs text-white/60">Dica premium</p>
                  <p className="mt-2 text-sm text-white/75 leading-relaxed">
                    {tab === "minha"
                      ? "Use descrições curtas e objetivas. Seu aluno entende rápido e você reduz mensagens repetidas."
                      : "Importe do catálogo e depois personalize com seu estilo. Você ganha velocidade e mantém identidade."}
                  </p>
                  <div className="mt-3 inline-flex rounded-full border border-lime-300/20 bg-lime-400/10 px-3 py-1 text-xs font-bold text-lime-300">
                    UX de produto grande
                  </div>
                </div>
              </div>

              {/* CONTROLS */}
              {tab === "minha" ? (
                <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex-1">
                    <label className="text-xs text-white/50">Buscar</label>
                    <input
                      value={queryMine}
                      onChange={(e) => setQueryMine(e.target.value)}
                      placeholder="Digite nome ou descrição…"
                      className="mt-1 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-lime-300/40"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setOnlyWithVideoMine((v) => !v)}
                      className={cx(
                        "rounded-2xl border px-4 py-3 text-sm font-bold transition",
                        onlyWithVideoMine
                          ? "border-lime-300/30 bg-lime-400/10 text-lime-300"
                          : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
                      )}
                    >
                      {onlyWithVideoMine ? "Só com vídeo ✓" : "Só com vídeo"}
                    </button>

                    <button
                      onClick={() => setSortMine((s) => (s === "az" ? "za" : "az"))}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white/75 hover:bg-white/10"
                    >
                      Ordenar: {sortMine === "az" ? "A → Z" : "Z → A"}
                    </button>

                    <button
                      onClick={() => {
                        setQueryMine("");
                        setOnlyWithVideoMine(false);
                        setSortMine("az");
                      }}
                      className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold text-white/70 hover:bg-white/5"
                    >
                      Limpar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-6 grid gap-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="text-xs text-white/50">Buscar no catálogo</label>
                      <input
                        value={queryCat}
                        onChange={(e) => setQueryCat(e.target.value)}
                        placeholder="Nome, músculo, objetivo, equipamento…"
                        className="mt-1 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-lime-300/40"
                      />
                    </div>

                    <div className="flex flex-wrap items-end gap-2">
                      <button
                        onClick={() => setOnlyWithVideoCat((v) => !v)}
                        className={cx(
                          "rounded-2xl border px-4 py-3 text-sm font-bold transition",
                          onlyWithVideoCat
                            ? "border-lime-300/30 bg-lime-400/10 text-lime-300"
                            : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
                        )}
                      >
                        {onlyWithVideoCat ? "Só com vídeo ✓" : "Só com vídeo"}
                      </button>

                      <button
                        onClick={() => setSortCat((s) => (s === "az" ? "za" : "az"))}
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white/75 hover:bg-white/10"
                      >
                        Ordenar: {sortCat === "az" ? "A → Z" : "Z → A"}
                      </button>

                      <button
                        onClick={() => {
                          setQueryCat("");
                          setOnlyWithVideoCat(false);
                          setSortCat("az");
                          setFilterCategoria("");
                          setFilterGrupo("");
                          setFilterEquip("");
                          setFilterNivel("");
                        }}
                        className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold text-white/70 hover:bg-white/5"
                      >
                        Limpar filtros
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-4">
                    <div>
                      <label className="text-xs text-white/50">Categoria</label>
                      <select
                        value={filterCategoria}
                        onChange={(e) => setFilterCategoria(e.target.value)}
                        className="mt-1 w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-3 text-sm text-white outline-none focus:border-lime-300/40"
                      >
                        <option value="">Todas</option>
                        {categorias.map((x) => (
                          <option key={x} value={x}>
                            {x}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-white/50">Grupo muscular</label>
                      <select
                        value={filterGrupo}
                        onChange={(e) => setFilterGrupo(e.target.value)}
                        className="mt-1 w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-3 text-sm text-white outline-none focus:border-lime-300/40"
                      >
                        <option value="">Todos</option>
                        {grupos.map((x) => (
                          <option key={x} value={x}>
                            {x}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-white/50">Equipamento</label>
                      <select
                        value={filterEquip}
                        onChange={(e) => setFilterEquip(e.target.value)}
                        className="mt-1 w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-3 text-sm text-white outline-none focus:border-lime-300/40"
                      >
                        <option value="">Todos</option>
                        {equips.map((x) => (
                          <option key={x} value={x}>
                            {x}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-white/50">Nível</label>
                      <select
                        value={filterNivel}
                        onChange={(e) => setFilterNivel(e.target.value)}
                        className="mt-1 w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-3 text-sm text-white outline-none focus:border-lime-300/40"
                      >
                        <option value="">Todos</option>
                        {niveis.map((x) => (
                          <option key={x} value={x}>
                            {x}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {selectedCount > 0 ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-lime-300/20 bg-lime-400/10 px-4 py-3">
                      <p className="text-sm font-bold text-lime-200">
                        {selectedCount} selecionado(s) para importar
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setSelectedCatalog({})}
                          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/80 hover:bg-white/10"
                        >
                          Limpar seleção
                        </button>
                        <button
                          onClick={importSelected}
                          disabled={isSubmitting}
                          className="rounded-2xl bg-lime-400 px-4 py-2 text-xs font-extrabold text-black hover:bg-lime-300 disabled:opacity-60"
                        >
                          Importar agora
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* LIST */}
        <div className="mt-6">
          {tab === "minha" ? (
            filteredMine.length === 0 ? (
              <div className="rounded-[2rem] border border-white/10 bg-white/5 p-10 text-center shadow-2xl">
                <p className="text-xl font-extrabold text-white">Nada por aqui…</p>
                <p className="mt-2 text-sm text-white/60">
                  {totalMine === 0
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
                      setQueryMine("");
                      setOnlyWithVideoMine(false);
                      setSortMine("az");
                    }}
                    className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-bold text-white/80 hover:bg-white/10"
                  >
                    Limpar filtros
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredMine.map((ex) => {
                  const yid = getYouTubeId(ex.link_youtube);
                  const isOpen = !!expandedVideoMine[ex.id];

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
                                  setExpandedVideoMine((prev) => ({ ...prev, [ex.id]: !prev[ex.id] }))
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
            )
          ) : (
            // -----------------------------
            // CATÁLOGO
            // -----------------------------
            loadingCatalogo ? (
              <div className="rounded-[2rem] border border-white/10 bg-white/5 p-10 text-center shadow-2xl">
                <p className="text-white/70">Carregando catálogo…</p>
              </div>
            ) : filteredCat.length === 0 ? (
              <div className="rounded-[2rem] border border-white/10 bg-white/5 p-10 text-center shadow-2xl">
                <p className="text-xl font-extrabold text-white">Nada encontrado…</p>
                <p className="mt-2 text-sm text-white/60">Ajuste busca/filtros para explorar melhor.</p>
                <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
                  <button
                    onClick={() => {
                      setQueryCat("");
                      setOnlyWithVideoCat(false);
                      setSortCat("az");
                      setFilterCategoria("");
                      setFilterGrupo("");
                      setFilterEquip("");
                      setFilterNivel("");
                    }}
                    className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-bold text-white/80 hover:bg-white/10"
                  >
                    Limpar filtros
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredCat.map((c) => {
                  const yid = getYouTubeId(c.link_video);
                  const isOpen = !!expandedVideoCat[c.id];
                  const checked = !!selectedCatalog[c.id];

                  return (
                    <div
                      key={c.id}
                      className={cx(
                        "rounded-[1.75rem] border bg-white/5 p-5 shadow-[0_25px_80px_rgba(0,0,0,0.50)]",
                        checked ? "border-lime-300/30" : "border-white/10"
                      )}
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-lg font-extrabold text-white truncate">{c.nome}</p>

                            {yid ? (
                              <span className="rounded-full border border-lime-300/25 bg-lime-400/10 px-3 py-1 text-xs font-bold text-lime-300">
                                Vídeo
                              </span>
                            ) : (
                              <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-bold text-white/60">
                                Sem vídeo
                              </span>
                            )}

                            {c.categoria ? (
                              <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-bold text-white/70">
                                {c.categoria}
                              </span>
                            ) : null}

                            {c.grupo_muscular ? (
                              <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-bold text-white/70">
                                {c.grupo_muscular}
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-2 grid gap-1 text-xs text-white/60">
                            <div>
                              <span className="text-white/40">Músculo principal:</span>{" "}
                              <span className="text-white/75">{c.musculo_principal || "—"}</span>
                            </div>
                            <div>
                              <span className="text-white/40">Secundários:</span>{" "}
                              <span className="text-white/75">{c.musculos_secundarios || "—"}</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span className="text-white/40">Equipamento:</span>{" "}
                              <span className="text-white/75">{c.equipamento || "—"}</span>
                              <span className="text-white/40">• Nível:</span>{" "}
                              <span className="text-white/75">{c.nivel || "—"}</span>
                              <span className="text-white/40">• Objetivo:</span>{" "}
                              <span className="text-white/75">{c.objetivo || "—"}</span>
                            </div>
                          </div>

                          {c.descricao_tecnica ? (
                            <p className="mt-3 text-sm text-white/70 leading-relaxed">{c.descricao_tecnica}</p>
                          ) : (
                            <p className="mt-3 text-sm text-white/40 italic">Sem descrição técnica.</p>
                          )}

                          <div className="mt-3 flex flex-wrap gap-2">
                            {c.link_video ? (
                              <a
                                href={c.link_video}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-xs font-bold text-white/80 hover:bg-white/5"
                              >
                                Abrir vídeo →
                              </a>
                            ) : null}

                            {yid ? (
                              <button
                                onClick={() =>
                                  setExpandedVideoCat((prev) => ({ ...prev, [c.id]: !prev[c.id] }))
                                }
                                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-lime-300 hover:bg-white/10"
                              >
                                {isOpen ? "Ocultar preview" : "Ver preview"}
                              </button>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 md:items-end">
                          <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/80">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                setSelectedCatalog((prev) => ({ ...prev, [c.id]: e.target.checked }))
                              }
                              className="h-4 w-4 accent-lime-400"
                            />
                            Selecionar
                          </label>

                          <button
                            onClick={() => addFromCatalog(c)}
                            disabled={isSubmitting}
                            className="rounded-2xl bg-lime-400 px-4 py-2 text-sm font-extrabold text-black hover:bg-lime-300 disabled:opacity-60"
                          >
                            + Adicionar à minha
                          </button>
                        </div>
                      </div>

                      {yid && isOpen ? (
                        <div className="mt-4 overflow-hidden rounded-3xl border border-white/10 bg-black/40">
                          <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
                            <iframe
                              className="absolute inset-0 h-full w-full"
                              src={`https://www.youtube.com/embed/${yid}`}
                              title={`YouTube preview - ${c.nome}`}
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
            )
          )}
        </div>

        {/* FOOT */}
        <div className="mt-8 text-center text-xs text-white/40">Motion • Biblioteca Premium</div>
      </div>

      {/* ADD MODAL (Minha) */}
      <Modal
        open={showAddModal}
        title="Adicionar novo exercício"
        subtitle="Crie do seu jeito — nome regional, descrição e vídeo"
        onClose={() => setShowAddModal(false)}
      >
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

          <div className="flex flex-col gap-2 sm:flex-row sm:justify
          -end">
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

      {/* EDIT MODAL (Minha) */}
      <Modal
        open={showEditModal && !!currentExercicio}
        title="Editar exercício"
        subtitle="Ajuste rápido e mantenha sua biblioteca impecável"
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