"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/utils/supabase-browser";

// -------------------- Interfaces --------------------
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
  ambiente: string | null; // ex: "Casa", "Academia"
  nivel: string | null;
  descricao_tecnica: string | null;
  link_video: string | null; // youtube
  // se você tiver outras colunas, não tem problema
}

interface TreinoExercicioData {
  rotina_id: string;
  exercicio_id: string | null; // biblioteca
  catalogo_id?: string | null; // catálogo
  ordem: number;
  series: number | null;
  repeticoes: string | null;
  carga: string | null;
  intervalo: string | null;
  observacoes: string | null;
}

interface TreinoExercicioDisplay extends TreinoExercicioData {
  id: string; // id local do modal
  nomeExercicio: string;
  origem: "biblioteca" | "catalogo";
  link_video?: string | null;
}

interface RotinaDiaria {
  id: string;
  plano_id: string;
  nome: string;
  descricao: string | null;
  created_at: string;
  treino_exercicios: TreinoExercicioData[];
}

interface PlanoTreino {
  id: string;
  nome: string;
  descricao: string | null;
  aluno_id: string | null;
  professor_id: string;
  tipo_treino: string | null;
  objetivo: string | null;
  dificuldade: string | null;
  orientacao_professor: string | null;
  created_at: string;
  aluno_nome: string | null;
  rotinas_diarias: RotinaDiaria[];
}

// -------------------- Utils --------------------
function normalizeStr(v: string | null | undefined) {
  return (v || "").toLowerCase().trim();
}

function clampOrder(list: TreinoExercicioDisplay[]) {
  return list
    .slice()
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
    .map((item, idx) => ({ ...item, ordem: idx + 1 }));
}

function uniqSorted(arr: string[]) {
  return Array.from(new Set(arr.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
}

// -------------------- Modo Turbo (regras) --------------------
function turboSuggest(desc: string) {
  const d = normalizeStr(desc);

  const out: {
    objetivo?: string;
    grupo_muscular?: string;
    ambiente?: string;
    equipamento?: string;
    categoria?: string;
    nivel?: string;
  } = {};

  // ambiente
  if (d.includes("casa") || d.includes("home")) out.ambiente = "Casa";

  // categorias especiais
  if (d.includes("abd") || d.includes("abdom") || d.includes("core"))
    out.categoria = "Abdominais";
  if (d.includes("along") || d.includes("stretch"))
    out.categoria = "Alongamento";
  if (d.includes("mobil")) out.categoria = "Mobilidade";
  if (d.includes("cardio") || d.includes("aerob") || d.includes("hiit"))
    out.categoria = "Cardio/Funcional";

  // grupos musculares (bem prático)
  if (d.includes("glute") || d.includes("glúte")) out.grupo_muscular = "Glúteos";
  if (d.includes("posterior") || d.includes("isquio"))
    out.grupo_muscular = "Posterior de Coxa";
  if (d.includes("quadr") || d.includes("coxa") || d.includes("perna"))
    out.grupo_muscular = "Pernas";
  if (d.includes("peito") || d.includes("peitoral"))
    out.grupo_muscular = "Peitoral";
  if (d.includes("costas") || d.includes("dorsal"))
    out.grupo_muscular = "Costas";
  if (d.includes("ombro") || d.includes("delto"))
    out.grupo_muscular = "Ombros";
  if (d.includes("biceps") || d.includes("bíce"))
    out.grupo_muscular = "Bíceps";
  if (d.includes("triceps") || d.includes("tríce"))
    out.grupo_muscular = "Tríceps";

  // objetivo
  if (d.includes("hipertrof")) out.objetivo = "Hipertrofia";
  if (d.includes("defini")) out.objetivo = "Definição";
  if (d.includes("emagrec") || d.includes("gordura"))
    out.objetivo = "Redução de Gordura";
  if (d.includes("condicion")) out.objetivo = "Condicionamento";

  // nível
  if (d.includes("iniciante")) out.nivel = "Iniciante";
  if (d.includes("intermedi")) out.nivel = "Intermediario";
  if (d.includes("avancad") || d.includes("avançad")) out.nivel = "Avancado";

  // equipamento “pistas”
  if (d.includes("halter")) out.equipamento = "Halteres";
  if (d.includes("barra")) out.equipamento = "Barra";
  if (d.includes("maquina") || d.includes("máquina"))
    out.equipamento = "Máquina";
  if (d.includes("cabo") || d.includes("polia"))
    out.equipamento = "Cabo/Polia";
  if (d.includes("peso corporal") || d.includes("peso do corpo"))
    out.equipamento = "Peso corporal";

  return out;
}

export default function ProfessorTreinosPage() {
  const router = useRouter();

  // Estados globais
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [professorId, setProfessorId] = useState<string | null>(null);
  const [exerciciosBiblioteca, setExerciciosBiblioteca] = useState<Exercicio[]>(
    []
  );
  const [planosTreino, setPlanosTreino] = useState<PlanoTreino[]>([]);

  // Busca / filtro planos
  const [busca, setBusca] = useState("");

  // Modais
  const [showCreatePlanoModal, setShowCreatePlanoModal] = useState(false);
  const [showEditPlanoModal, setShowEditPlanoModal] = useState(false);
  const [showCreateRotinaModal, setShowCreateRotinaModal] = useState(false);
  const [showEditRotinaModal, setShowEditRotinaModal] = useState(false);

  // Contexto
  const [currentPlano, setCurrentPlano] = useState<PlanoTreino | null>(null);
  const [currentRotina, setCurrentRotina] = useState<RotinaDiaria | null>(null);

  // Forms
  const [planoFormData, setPlanoFormData] = useState({
    nome: "",
    descricao: "",
    tipo_treino: "",
    objetivo: "",
    dificuldade: "",
    orientacao_professor: "",
  });

  const [rotinaFormData, setRotinaFormData] = useState({
    nome: "",
    descricao: "",
  });

  const [editPlanoFormData, setEditPlanoFormData] = useState({
    nome: "",
    descricao: "",
    aluno_id: "",
    tipo_treino: "",
    objetivo: "",
    dificuldade: "",
    orientacao_professor: "",
  });

  const [editRotinaFormData, setEditRotinaFormData] = useState({
    nome: "",
    descricao: "",
  });

  // Exercícios nos modais
  const [exerciciosNaRotinaModal, setExerciciosNaRotinaModal] = useState<
    TreinoExercicioDisplay[]
  >([]);
  const [exerciciosNaEdicaoDeRotinaModal, setExerciciosNaEdicaoDeRotinaModal] =
    useState<TreinoExercicioDisplay[]>([]);

  // -------------------- Catálogo Premium (estado) --------------------
  const [fonteLista, setFonteLista] = useState<"biblioteca" | "catalogo">(
    "catalogo"
  );
  const [catalogo, setCatalogo] = useState<ExercicioCatalogo[]>([]);
  const [loadingCatalogo, setLoadingCatalogo] = useState(false);

  // filtros catálogo
  const [catBusca, setCatBusca] = useState("");
  const [fCategoria, setFCategoria] = useState("Todas");
  const [fGrupo, setFGrupo] = useState("Todos");
  const [fEquipamento, setFEquipamento] = useState("Todos");
  const [fNivel, setFNivel] = useState("Todos");
  const [fAmbiente, setFAmbiente] = useState("Todos");
  const [fObjetivo, setFObjetivo] = useState("Todos");

  // seleção em massa catálogo
  const [catSelectedIds, setCatSelectedIds] = useState<Set<string>>(
    new Set()
  );

  // -------------------- Auth + fetch --------------------
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError || profile?.role !== "professor") {
        router.push("/dashboard");
        return;
      }

      setProfessorId(user.id);
      await fetchData(user.id);
    })();
  }, [router]);

  async function fetchData(pId: string) {
    setLoading(true);
    setError(null);

    try {
      const { data: exerciciosData, error: exerciciosError } = await supabase
        .from("exercicios")
        .select("id, nome, descricao, link_youtube, professor_id")
        .eq("professor_id", pId)
        .order("nome", { ascending: true });

      if (exerciciosError) throw exerciciosError;
      setExerciciosBiblioteca(exerciciosData || []);

      const { data: planosTreinoRawData, error: planosTreinoError } =
        await supabase
          .from("treinos")
          .select(
            `
          id,
          nome,
          descricao,
          aluno_id,
          professor_id,
          tipo_treino,
          objetivo,
          dificuldade,
          orientacao_professor,
          created_at,
          rotinas_diarias(
            id,
            plano_id,
            nome,
            descricao,
            created_at,
            treino_exercicios(
              rotina_id,
              exercicio_id,
              catalogo_id,
              ordem,
              series,
              repeticoes,
              carga,
              intervalo,
              observacoes
            )
          )
        `
          )
          .eq("professor_id", pId)
          .order("created_at", { ascending: false });

      if (planosTreinoError) throw planosTreinoError;

      const formatted: PlanoTreino[] = (planosTreinoRawData || []).map(
        (plano: any) => ({
          ...plano,
          rotinas_diarias: (plano.rotinas_diarias || []).map((rotina: any) => ({
            ...rotina,
            treino_exercicios: rotina.treino_exercicios || [],
          })),
        })
      );

      setPlanosTreino(formatted);
    } catch (err: any) {
      console.error("Erro ao buscar dados:", err?.message);
      setError("Erro ao carregar dados: " + (err?.message || "desconhecido"));
    } finally {
      setLoading(false);
    }
  }
  // -------------------- Fetch catálogo (lazy) --------------------
  async function fetchCatalogoIfNeeded() {
    if (catalogo.length > 0) return;
    setLoadingCatalogo(true);
    try {
      const { data, error } = await supabase
        .from("exercicios_catalogo")
        .select(
          "id, nome, categoria, subcategoria, grupo_muscular, musculo_principal, musculos_secundarios, objetivo, equipamento, ambiente, nivel, descricao_tecnica, link_video"
        )
        .order("nome", { ascending: true });

      if (error) throw error;
      setCatalogo((data as any) || []);
    } catch (e: any) {
      console.error(e?.message);
      setError("Erro ao carregar catálogo premium: " + (e?.message || "desconhecido"));
    } finally {
      setLoadingCatalogo(false);
    }
  }

  // -------------------- Handlers input --------------------
  const handlePlanoFormInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setPlanoFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRotinaFormInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setRotinaFormData((prev) => ({ ...prev, [name]: value }));
  };

  // -------------------- Plano: criar/editar/deletar --------------------
  const handleOpenCreatePlanoModal = () => {
    setPlanoFormData({
      nome: "",
      descricao: "",
      tipo_treino: "",
      objetivo: "",
      dificuldade: "",
      orientacao_professor: "",
    });
    setError(null);
    setShowCreatePlanoModal(true);
  };

  const handleCloseCreatePlanoModal = () => {
    setShowCreatePlanoModal(false);
    setError(null);
  };

  const handleCreatePlano = async () => {
    if (
      !planoFormData.nome.trim() ||
      !planoFormData.tipo_treino ||
      !planoFormData.objetivo ||
      !planoFormData.dificuldade
    ) {
      setError("Preencha os obrigatórios do Plano (Nome, Tipo, Objetivo, Dificuldade).");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { error: planoError } = await supabase.from("treinos").insert({
        nome: planoFormData.nome,
        descricao: planoFormData.descricao || null,
        aluno_id: null,
        professor_id: professorId,
        tipo_treino: planoFormData.tipo_treino,
        objetivo: planoFormData.objetivo,
        dificuldade: planoFormData.dificuldade,
        orientacao_professor: planoFormData.orientacao_professor || null,
      });

      if (planoError) throw planoError;

      alert("Plano criado! Agora adicione as rotinas.");
      setShowCreatePlanoModal(false);
      await fetchData(professorId!);
    } catch (err: any) {
      setError("Erro ao criar plano: " + (err?.message || "desconhecido"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditPlanoModal = (plano: PlanoTreino) => {
    setCurrentPlano(plano);
    setEditPlanoFormData({
      nome: plano.nome,
      descricao: plano.descricao || "",
      aluno_id: plano.aluno_id || "",
      tipo_treino: plano.tipo_treino || "",
      objetivo: plano.objetivo || "",
      dificuldade: plano.dificuldade || "",
      orientacao_professor: plano.orientacao_professor || "",
    });
    setError(null);
    setShowEditPlanoModal(true);
  };

  const handleCloseEditPlanoModal = () => {
    setShowEditPlanoModal(false);
    setCurrentPlano(null);
    setError(null);
  };

  const handleUpdatePlano = async () => {
    if (!currentPlano) return;

    if (
      !editPlanoFormData.nome.trim() ||
      !editPlanoFormData.tipo_treino ||
      !editPlanoFormData.objetivo ||
      !editPlanoFormData.dificuldade
    ) {
      setError("Preencha os obrigatórios do Plano (Nome, Tipo, Objetivo, Dificuldade).");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { error: planoError } = await supabase
        .from("treinos")
        .update({
          nome: editPlanoFormData.nome,
          descricao: editPlanoFormData.descricao || null,
          aluno_id: editPlanoFormData.aluno_id || null,
          tipo_treino: editPlanoFormData.tipo_treino,
          objetivo: editPlanoFormData.objetivo,
          dificuldade: editPlanoFormData.dificuldade,
          orientacao_professor: editPlanoFormData.orientacao_professor || null,
        })
        .eq("id", currentPlano.id);

      if (planoError) throw planoError;

      alert("Plano atualizado!");
      setShowEditPlanoModal(false);
      setCurrentPlano(null);
      await fetchData(professorId!);
    } catch (err: any) {
      setError("Erro ao atualizar plano: " + (err?.message || "desconhecido"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePlano = async (planoId: string) => {
    if (!confirm("Deletar este Plano e todas as rotinas/exercícios associados?")) return;

    setLoading(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase.from("treinos").delete().eq("id", planoId);
      if (deleteError) throw deleteError;

      alert("Plano deletado!");
      await fetchData(professorId!);
    } catch (err: any) {
      setError("Erro ao deletar plano: " + (err?.message || "desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  // -------------------- Rotina: criar --------------------
  const handleOpenCreateRotinaModal = async (plano: PlanoTreino) => {
    setCurrentPlano(plano);
    setRotinaFormData({ nome: "", descricao: "" });
    setExerciciosNaRotinaModal([]);
    setCatBusca("");
    setCatSelectedIds(new Set());
    setError(null);
    setShowCreateRotinaModal(true);

    await fetchCatalogoIfNeeded();
    setFonteLista("catalogo");
  };

  const handleCloseCreateRotinaModal = () => {
    setShowCreateRotinaModal(false);
    setCurrentPlano(null);
    setRotinaFormData({ nome: "", descricao: "" });
    setExerciciosNaRotinaModal([]);
    setCatSelectedIds(new Set());
    setError(null);
  };

  // add biblioteca
  const addExercicioBibliotecaToRotinaModal = (exercicio: Exercicio) => {
    setExerciciosNaRotinaModal((prev) => {
      if (prev.find((x) => x.origem === "biblioteca" && x.exercicio_id === exercicio.id)) {
        setError("Este exercício já foi adicionado à rotina.");
        return prev;
      }
      setError(null);

      return [
        ...prev,
        {
          id: uuidv4(),
          nomeExercicio: exercicio.nome,
          origem: "biblioteca" as const,
          exercicio_id: exercicio.id,
          catalogo_id: null,
          rotina_id: "",
          ordem: prev.length + 1,
          series: null,
          repeticoes: "",
          carga: "",
          intervalo: "",
          observacoes: "",
          link_video: exercicio.link_youtube,
        },
      ];
    });
  };

  // add catálogo
  const addCatalogoToRotinaModal = (ex: ExercicioCatalogo) => {
    setExerciciosNaRotinaModal((prev) => {
      if (prev.find((x) => x.origem === "catalogo" && x.catalogo_id === ex.id)) {
        setError("Este exercício do catálogo já foi adicionado à rotina.");
        return prev;
      }
      setError(null);

      return [
        ...prev,
        {
          id: uuidv4(),
          nomeExercicio: ex.nome,
          origem: "catalogo" as const,
          exercicio_id: null,
          catalogo_id: ex.id,
          rotina_id: "",
          ordem: prev.length + 1,
          series: null,
          repeticoes: "",
          carga: "",
          intervalo: "",
          observacoes: "",
          link_video: ex.link_video,
        },
      ];
    });
  };

  const updateExercicioNaRotinaModal = (
    idLocal: string,
    field: keyof TreinoExercicioDisplay,
    value: any
  ) => {
    setExerciciosNaRotinaModal((prev) =>
      prev.map((ex) => (ex.id === idLocal ? { ...ex, [field]: value } : ex))
    );
  };

  const removeExercicioNaRotinaModal = (idLocal: string) => {
    setExerciciosNaRotinaModal((prev) => clampOrder(prev.filter((ex) => ex.id !== idLocal)));
  };

  const handleCreateRotina = async () => {
    if (!currentPlano || !rotinaFormData.nome.trim()) {
      setError("Preencha o Nome da Rotina.");
      return;
    }
    if (exerciciosNaRotinaModal.length === 0) {
      setError("Adicione pelo menos um exercício.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { data: novaRotina, error: rotinaError } = await supabase
        .from("rotinas_diarias")
        .insert({
          plano_id: currentPlano.id,
          nome: rotinaFormData.nome,
          descricao: rotinaFormData.descricao || null,
        })
        .select()
        .single();

      if (rotinaError) throw rotinaError;

      const payload = clampOrder(exerciciosNaRotinaModal).map((ex) => ({
        rotina_id: novaRotina.id,
        exercicio_id: ex.origem === "biblioteca" ? ex.exercicio_id : null,
        catalogo_id: ex.origem === "catalogo" ? ex.catalogo_id : null,
        ordem: ex.ordem,
        series: ex.series,
        repeticoes: ex.repeticoes,
        carga: ex.carga,
        intervalo: ex.intervalo,
        observacoes: ex.observacoes,
      }));

      const { error: insertError } = await supabase.from("treino_exercicios").insert(payload);
      if (insertError) throw insertError;

      alert(`Rotina "${novaRotina.nome}" criada com sucesso!`);
      handleCloseCreateRotinaModal();
      await fetchData(professorId!);
    } catch (err: any) {
      setError("Erro ao criar rotina: " + (err?.message || "desconhecido"));
    } finally {
      setIsSubmitting(false);
    }
  };
  // -------------------- Rotina: editar --------------------
  const handleOpenEditRotinaModal = async (plano: PlanoTreino, rotina: RotinaDiaria) => {
    setCurrentPlano(plano);
    setCurrentRotina(rotina);
    setEditRotinaFormData({ nome: rotina.nome, descricao: rotina.descricao || "" });
    setError(null);
    setShowEditRotinaModal(true);

    await fetchCatalogoIfNeeded();

    const base = (rotina.treino_exercicios || []).map((te) => {
      if (te.exercicio_id) {
        const ex = exerciciosBiblioteca.find((e) => e.id === te.exercicio_id);
        return {
          id: uuidv4(),
          nomeExercicio: ex?.nome || "Exercício",
          origem: "biblioteca" as const,
          rotina_id: rotina.id,
          exercicio_id: te.exercicio_id,
          catalogo_id: null,
          ordem: te.ordem,
          series: te.series,
          repeticoes: te.repeticoes,
          carga: te.carga,
          intervalo: te.intervalo,
          observacoes: te.observacoes,
          link_video: ex?.link_youtube || null,
        } as TreinoExercicioDisplay;
      } else {
        const cx = catalogo.find((c) => c.id === te.catalogo_id);
        return {
          id: uuidv4(),
          nomeExercicio: cx?.nome || "Exercício (Catálogo)",
          origem: "catalogo" as const,
          rotina_id: rotina.id,
          exercicio_id: null,
          catalogo_id: te.catalogo_id || null,
          ordem: te.ordem,
          series: te.series,
          repeticoes: te.repeticoes,
          carga: te.carga,
          intervalo: te.intervalo,
          observacoes: te.observacoes,
          link_video: cx?.link_video || null,
        } as TreinoExercicioDisplay;
      }
    });

    setExerciciosNaEdicaoDeRotinaModal(clampOrder(base));
    setFonteLista("catalogo");
    setCatBusca("");
    setCatSelectedIds(new Set());
  };

  const handleCloseEditRotinaModal = () => {
    setShowEditRotinaModal(false);
    setCurrentPlano(null);
    setCurrentRotina(null);
    setEditRotinaFormData({ nome: "", descricao: "" });
    setExerciciosNaEdicaoDeRotinaModal([]);
    setCatSelectedIds(new Set());
    setError(null);
  };

  const addExercicioBibliotecaToEditRotinaModal = (exercicio: Exercicio) => {
    setExerciciosNaEdicaoDeRotinaModal((prev) => {
      if (prev.find((x) => x.origem === "biblioteca" && x.exercicio_id === exercicio.id)) {
        setError("Este exercício já está nesta rotina.");
        return prev;
      }
      setError(null);

      const next = [
        ...prev,
        {
          id: uuidv4(),
          nomeExercicio: exercicio.nome,
          origem: "biblioteca" as const,
          exercicio_id: exercicio.id,
          catalogo_id: null,
          rotina_id: currentRotina?.id || "",
          ordem: prev.length + 1,
          series: null,
          repeticoes: "",
          carga: "",
          intervalo: "",
          observacoes: "",
          link_video: exercicio.link_youtube,
        },
      ];

      return clampOrder(next);
    });
  };

  const addCatalogoToEditRotinaModal = (ex: ExercicioCatalogo) => {
    setExerciciosNaEdicaoDeRotinaModal((prev) => {
      if (prev.find((x) => x.origem === "catalogo" && x.catalogo_id === ex.id)) {
        setError("Este exercício do catálogo já está nesta rotina.");
        return prev;
      }
      setError(null);

      const next = [
        ...prev,
        {
          id: uuidv4(),
          nomeExercicio: ex.nome,
          origem: "catalogo" as const,
          exercicio_id: null,
          catalogo_id: ex.id,
          rotina_id: currentRotina?.id || "",
          ordem: prev.length + 1,
          series: null,
          repeticoes: "",
          carga: "",
          intervalo: "",
          observacoes: "",
          link_video: ex.link_video,
        },
      ];

      return clampOrder(next);
    });
  };

  const updateExercicioNaEdicaoDeRotinaModal = (
    idLocal: string,
    field: keyof TreinoExercicioDisplay,
    value: any
  ) => {
    setExerciciosNaEdicaoDeRotinaModal((prev) =>
      prev.map((ex) => (ex.id === idLocal ? { ...ex, [field]: value } : ex))
    );
  };

  const removeExercicioNaEdicaoDeRotinaModal = (idLocal: string) => {
    setExerciciosNaEdicaoDeRotinaModal((prev) => clampOrder(prev.filter((ex) => ex.id !== idLocal)));
  };

  const moveExercicio = (idLocal: string, direction: "up" | "down") => {
    setExerciciosNaEdicaoDeRotinaModal((prev) => {
      const list = clampOrder(prev);
      const idx = list.findIndex((x) => x.id === idLocal);
      if (idx < 0) return list;

      const target = direction === "up" ? idx - 1 : idx + 1;
      if (target < 0 || target >= list.length) return list;

      const swapped = list.slice();
      const tmp = swapped[idx];
      swapped[idx] = swapped[target];
      swapped[target] = tmp;

      return clampOrder(swapped);
    });
  };

  const handleUpdateRotina = async () => {
    if (!currentRotina || !currentPlano) return;

    if (!editRotinaFormData.nome.trim()) {
      setError("Informe o nome da rotina.");
      return;
    }
    if (exerciciosNaEdicaoDeRotinaModal.length === 0) {
      setError("A rotina precisa ter pelo menos um exercício.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { error: rotinaUpdateErr } = await supabase
        .from("rotinas_diarias")
        .update({
          nome: editRotinaFormData.nome,
          descricao: editRotinaFormData.descricao || null,
        })
        .eq("id", currentRotina.id);

      if (rotinaUpdateErr) throw rotinaUpdateErr;

      const { error: delErr } = await supabase
        .from("treino_exercicios")
        .delete()
        .eq("rotina_id", currentRotina.id);
      if (delErr) throw delErr;

      const payload = clampOrder(exerciciosNaEdicaoDeRotinaModal).map((ex) => ({
        rotina_id: currentRotina.id,
        exercicio_id: ex.origem === "biblioteca" ? ex.exercicio_id : null,
        catalogo_id: ex.origem === "catalogo" ? ex.catalogo_id : null,
        ordem: ex.ordem,
        series: ex.series,
        repeticoes: ex.repeticoes,
        carga: ex.carga,
        intervalo: ex.intervalo,
        observacoes: ex.observacoes,
      }));

      const { error: insErr } = await supabase.from("treino_exercicios").insert(payload);
      if (insErr) throw insErr;

      alert("Rotina atualizada com sucesso!");
      handleCloseEditRotinaModal();
      await fetchData(professorId!);
    } catch (err: any) {
      setError("Erro ao atualizar rotina: " + (err?.message || "desconhecido"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRotina = async () => {
    if (!currentRotina) return;
    if (!confirm("Deletar esta rotina e seus exercícios?")) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const { error: delErr } = await supabase.from("rotinas_diarias").delete().eq("id", currentRotina.id);
      if (delErr) throw delErr;

      alert("Rotina deletada!");
      handleCloseEditRotinaModal();
      await fetchData(professorId!);
    } catch (err: any) {
      setError("Erro ao deletar rotina: " + (err?.message || "desconhecido"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------- Catálogo: opções de filtros (dinâmicas) --------------------
  const optCategoria = useMemo(() => uniqSorted(catalogo.map((x) => x.categoria || "").filter(Boolean)), [catalogo]);
  const optGrupo = useMemo(() => uniqSorted(catalogo.map((x) => x.grupo_muscular || "").filter(Boolean)), [catalogo]);
  const optEquip = useMemo(() => uniqSorted(catalogo.map((x) => x.equipamento || "").filter(Boolean)), [catalogo]);
  const optNivel = useMemo(() => uniqSorted(catalogo.map((x) => x.nivel || "").filter(Boolean)), [catalogo]);
  const optAmb = useMemo(() => uniqSorted(catalogo.map((x) => x.ambiente || "").filter(Boolean)), [catalogo]);
  const optObj = useMemo(() => uniqSorted(catalogo.map((x) => x.objetivo || "").filter(Boolean)), [catalogo]);

  // -------------------- Catálogo: lista filtrada (com TURBO) --------------------
  const catalogoFiltrado = useMemo(() => {
    let list = catalogo;

    const q = normalizeStr(catBusca);
    if (q) {
      list = list.filter((x) => {
        const blob =
          `${x.nome} ${x.categoria} ${x.subcategoria} ${x.grupo_muscular} ${x.musculo_principal} ${x.musculos_secundarios} ${x.objetivo} ${x.equipamento} ${x.ambiente} ${x.nivel}`.toLowerCase();
        return blob.includes(q);
      });
    }

    if (fCategoria !== "Todas") list = list.filter((x) => (x.categoria || "") === fCategoria);
    if (fGrupo !== "Todos") list = list.filter((x) => (x.grupo_muscular || "") === fGrupo);
    if (fEquipamento !== "Todos") list = list.filter((x) => (x.equipamento || "") === fEquipamento);
    if (fNivel !== "Todos") list = list.filter((x) => (x.nivel || "") === fNivel);
    if (fAmbiente !== "Todos") list = list.filter((x) => (x.ambiente || "") === fAmbiente);
    if (fObjetivo !== "Todos") list = list.filter((x) => (x.objetivo || "") === fObjetivo);

    return list;
  }, [catalogo, catBusca, fCategoria, fGrupo, fEquipamento, fNivel, fAmbiente, fObjetivo]);

  // -------------------- TURBO: aplica filtros com base na descrição da rotina --------------------
  const applyTurboFrom = (desc: string) => {
    const sug = turboSuggest(desc || "");
    if (sug.categoria) setFCategoria(sug.categoria);
    if (sug.grupo_muscular) setFGrupo(sug.grupo_muscular);
    if (sug.equipamento) setFEquipamento(sug.equipamento);
    if (sug.ambiente) setFAmbiente(sug.ambiente);
    if (sug.objetivo) setFObjetivo(sug.objetivo);
    if (sug.nivel) setFNivel(sug.nivel);
  };

  // -------------------- Seleção em massa (catálogo) --------------------
  const toggleCatSelected = (id: string) => {
    setCatSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllOnScreen = () => {
    setCatSelectedIds((prev) => {
      const next = new Set(prev);
      catalogoFiltrado.forEach((x) => next.add(x.id));
      return next;
    });
  };

  const clearSelection = () => setCatSelectedIds(new Set());

  const addSelectedToCreateModal = () => {
    const selected = catalogo.filter((x) => catSelectedIds.has(x.id));
    selected.forEach(addCatalogoToRotinaModal);
    clearSelection();
  };

  const addSelectedToEditModal = () => {
    const selected = catalogo.filter((x) => catSelectedIds.has(x.id));
    selected.forEach(addCatalogoToEditRotinaModal);
    clearSelection();
  };

  // -------------------- Listagem filtrada (planos) --------------------
  const planosFiltrados = useMemo(() => {
    const q = normalizeStr(busca);
    if (!q) return planosTreino;

    return planosTreino.filter((p) => {
      const base =
        normalizeStr(p.nome) +
        " " +
        normalizeStr(p.objetivo) +
        " " +
        normalizeStr(p.dificuldade) +
        " " +
        normalizeStr(p.tipo_treino) +
        " " +
        normalizeStr(p.orientacao_professor) +
        " " +
        normalizeStr(p.aluno_nome);
      return base.includes(q);
    });
  }, [busca, planosTreino]);

  // -------------------- Render: loading/error --------------------
  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center text-lime-400 text-2xl">
        Carregando treinos...
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-red-500 text-lg p-4">
        <p className="text-center">{error}</p>
        <button
          onClick={() => setError(null)}
          className="mt-4 bg-lime-400 text-gray-900 py-2 px-6 rounded-full hover:bg-lime-300 transition duration-300"
        >
          Tentar Novamente
        </button>
      </main>
    );
  }
  // -------------------- UI helpers --------------------
  const CatalogoToolbar = ({ mode }: { mode: "create" | "edit" }) => (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 mb-3">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <input
            value={catBusca}
            onChange={(e) => setCatBusca(e.target.value)}
            placeholder="Buscar no catálogo: nome, músculo, objetivo, equipamento..."
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 outline-none focus:ring-2 focus:ring-lime-500/40"
          />

          <button
            type="button"
            onClick={() => {
              const desc = mode === "create" ? rotinaFormData.descricao : editRotinaFormData.descricao;
              applyTurboFrom(desc || "");
            }}
            className="shrink-0 rounded-full bg-lime-600 hover:bg-lime-700 px-4 py-2 text-sm font-bold"
          >
            ⚡ TURBO
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <select
            value={fCategoria}
            onChange={(e) => setFCategoria(e.target.value)}
            className="rounded bg-gray-200 text-gray-900 px-2 py-2"
          >
            <option value="Todas">Categoria: Todas</option>
            {optCategoria.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>

          <select
            value={fGrupo}
            onChange={(e) => setFGrupo(e.target.value)}
            className="rounded bg-gray-200 text-gray-900 px-2 py-2"
          >
            <option value="Todos">Grupo: Todos</option>
            {optGrupo.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>

          <select
            value={fEquipamento}
            onChange={(e) => setFEquipamento(e.target.value)}
            className="rounded bg-gray-200 text-gray-900 px-2 py-2"
          >
            <option value="Todos">Equip.: Todos</option>
            {optEquip.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>

          <select
            value={fAmbiente}
            onChange={(e) => setFAmbiente(e.target.value)}
            className="rounded bg-gray-200 text-gray-900 px-2 py-2"
          >
            <option value="Todos">Ambiente: Todos</option>
            {optAmb.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>

          <select
            value={fObjetivo}
            onChange={(e) => setFObjetivo(e.target.value)}
            className="rounded bg-gray-200 text-gray-900 px-2 py-2"
          >
            <option value="Todos">Objetivo: Todos</option>
            {optObj.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>

          <select
            value={fNivel}
            onChange={(e) => setFNivel(e.target.value)}
            className="rounded bg-gray-200 text-gray-900 px-2 py-2"
          >
            <option value="Todos">Nível: Todos</option>
            {optNivel.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="text-white/60 text-sm">
            {catalogoFiltrado.length} resultados • {catSelectedIds.size} selecionados
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={selectAllOnScreen}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
            >
              Selecionar todos (tela)
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
            >
              Limpar seleção
            </button>
            <button
              type="button"
              onClick={mode === "create" ? addSelectedToCreateModal : addSelectedToEditModal}
              disabled={catSelectedIds.size === 0}
              className="rounded-full bg-green-600 hover:bg-green-700 px-4 py-2 text-sm font-bold disabled:opacity-40"
            >
              Adicionar selecionados
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const CatalogoList = ({ mode }: { mode: "create" | "edit" }) => {
    if (loadingCatalogo) return <p className="text-white/60">Carregando catálogo premium...</p>;
    if (catalogo.length === 0) return <p className="text-white/60">Catálogo premium vazio.</p>;

    return (
      <div className="max-h-72 overflow-y-auto space-y-2">
        {catalogoFiltrado.map((ex) => (
          <div key={ex.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <input
                type="checkbox"
                checked={catSelectedIds.has(ex.id)}
                onChange={() => toggleCatSelected(ex.id)}
                className="h-4 w-4"
              />

              <div className="min-w-0">
                <p className="text-white truncate">{ex.nome}</p>
                <p className="text-xs text-white/60 truncate">
                  {ex.categoria ? `${ex.categoria}` : "Sem categoria"}
                  {ex.grupo_muscular ? ` • ${ex.grupo_muscular}` : ""}
                  {ex.equipamento ? ` • ${ex.equipamento}` : ""}
                  {ex.ambiente ? ` • ${ex.ambiente}` : ""}
                  {ex.nivel ? ` • ${ex.nivel}` : ""}
                </p>

                {ex.link_video ? (
                  <a
                    href={ex.link_video}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-white/60 hover:text-white/80 underline"
                  >
                    Ver vídeo
                  </a>
                ) : (
                  <span className="text-xs text-white/40">Sem vídeo</span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => (mode === "create" ? addCatalogoToRotinaModal(ex) : addCatalogoToEditRotinaModal(ex))}
              className="rounded-full bg-green-600 hover:bg-green-700 px-3 py-1 text-sm shrink-0"
            >
              + Add
            </button>
          </div>
        ))}
      </div>
    );
  };

  // -------------------- Render principal --------------------
  return (
    <main className="min-h-screen bg-gray-950 text-white py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <p className="text-white/60 text-sm">Motion</p>
            <h1 className="text-4xl font-bold text-lime-400">Gerenciar Planos de Treino</h1>
            <p className="text-white/60 mt-1">Crie, organize e edite rotinas sem perder tempo.</p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/professor/dashboard"
              className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-full transition duration-300"
            >
              ← Dashboard
            </Link>
            <button
              onClick={handleOpenCreatePlanoModal}
              className="bg-lime-600 hover:bg-lime-700 text-white font-bold py-2 px-6 rounded-full shadow-lg transition duration-300"
              type="button"
            >
              Criar Novo Plano
            </button>
          </div>
        </div>

        {/* Busca premium */}
        <div className="mb-8">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por plano, objetivo, dificuldade, aluno..."
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:ring-2 focus:ring-lime-500/40"
          />
        </div>

        {planosFiltrados.length === 0 ? (
          <p className="text-center text-gray-400 text-lg">Nenhum plano encontrado.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {planosFiltrados.map((plano) => (
              <div key={plano.id} className="bg-gray-800 p-6 rounded-2xl shadow-md border border-gray-700">
                <h2 className="text-2xl font-semibold text-lime-300 mb-2">{plano.nome}</h2>

                <div className="text-gray-300 space-y-1">
                  <p>
                    <span className="font-medium text-lime-200">Aluno:</span> {plano.aluno_nome || "Nenhum"}
                  </p>
                  <p>
                    <span className="font-medium text-lime-200">Tipo:</span> {plano.tipo_treino || "N/A"}
                  </p>
                  <p>
                    <span className="font-medium text-lime-200">Objetivo:</span> {plano.objetivo || "N/A"}
                  </p>
                  <p>
                    <span className="font-medium text-lime-200">Dificuldade:</span> {plano.dificuldade || "N/A"}
                  </p>
                  <p>
                    <span className="font-medium text-lime-200">Orientação:</span> {plano.orientacao_professor || "N/A"}
                  </p>
                </div>

                <div className="mt-4">
                  <h3 className="text-xl font-semibold text-lime-300 mb-2">Rotinas Diárias</h3>

                  {plano.rotinas_diarias && plano.rotinas_diarias.length > 0 ? (
                    <div className="space-y-2">
                      {plano.rotinas_diarias.map((rotina) => (
                        <div
                          key={rotina.id}
                          className="rounded-xl border border-white/10 bg-white/5 p-3 flex items-center justify-between"
                        >
                          <div>
                            <p className="text-white font-semibold">{rotina.nome}</p>
                            <p className="text-white/60 text-sm">{rotina.treino_exercicios.length} exercícios</p>
                          </div>

                          <button
                            onClick={() => handleOpenEditRotinaModal(plano, rotina)}
                            className="text-sm rounded-full bg-blue-600 hover:bg-blue-700 px-4 py-2 transition"
                            type="button"
                          >
                            Ver / Editar
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400">Nenhuma rotina adicionada.</p>
                  )}
                </div>

                <div className="flex justify-end space-x-2 mt-6">
                  <button
                    onClick={() => handleOpenCreateRotinaModal(plano)}
                    className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-full transition duration-300"
                    type="button"
                  >
                    + Rotina
                  </button>
                  <button
                    onClick={() => handleOpenEditPlanoModal(plano)}
                    className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-full transition duration-300"
                    type="button"
                  >
                    Editar Plano
                  </button>
                  <button
                    onClick={() => handleDeletePlano(plano.id)}
                    className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-full transition duration-300"
                    type="button"
                  >
                    Deletar Plano
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ---------------- MODAL: Criar Plano ---------------- */}
        {showCreatePlanoModal && (
          <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 p-8 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-3xl font-bold text-lime-400 mb-6 text-center">Criar Novo Plano</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-gray-300 text-sm font-bold mb-2">Nome do Plano</label>
                  <input
                    type="text"
                    name="nome"
                    value={planoFormData.nome}
                    onChange={handlePlanoFormInputChange}
                    className="w-full rounded px-3 py-2 text-gray-900 bg-gray-200"
                    placeholder="Ex: Plano Hipertrofia A"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 text-sm font-bold mb-2">Tipo de Treino</label>
                  <select
                    name="tipo_treino"
                    value={planoFormData.tipo_treino}
                    onChange={handlePlanoFormInputChange}
                    className="w-full rounded px-3 py-2 text-gray-900 bg-gray-200"
                  >
                    <option value="">Selecione</option>
                    <option value="Dias da Semana">Dias da Semana</option>
                    <option value="Numerico">Numérico</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-300 text-sm font-bold mb-2">Objetivo</label>
                  <select
                    name="objetivo"
                    value={planoFormData.objetivo}
                    onChange={handlePlanoFormInputChange}
                    className="w-full rounded px-3 py-2 text-gray-900 bg-gray-200"
                  >
                    <option value="">Selecione</option>
                    <option value="Hipertrofia">Hipertrofia</option>
                    <option value="Reducao de Gordura">Redução de Gordura</option>
                    <option value="Definicao Muscular">Definição Muscular</option>
                    <option value="Condicionamento Fisico">Condicionamento Físico</option>
                    <option value="Qualidade de Vida">Qualidade de Vida</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-300 text-sm font-bold mb-2">Dificuldade</label>
                  <select
                    name="dificuldade"
                    value={planoFormData.dificuldade}
                    onChange={handlePlanoFormInputChange}
                    className="w-full rounded px-3 py-2 text-gray-900 bg-gray-200"
                  >
                    <option value="">Selecione</option>
                    <option value="Adaptacao">Adaptação</option>
                    <option value="Iniciante">Iniciante</option>
                    <option value="Intermediario">Intermediário</option>
                    <option value="Avancado">Avançado</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-gray-300 text-sm font-bold mb-2">Orientações</label>
                  <textarea
                    name="orientacao_professor"
                    value={planoFormData.orientacao_professor}
                    onChange={handlePlanoFormInputChange}
                    className="w-full rounded px-3 py-2 text-gray-900 bg-gray-200 h-24"
                    placeholder="Ex: aquecer 5 min, manter forma, cadência..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseCreatePlanoModal}
                  className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-full"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreatePlano}
                  className="bg-lime-600 hover:bg-lime-700 text-white font-bold py-2 px-6 rounded-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Salvando..." : "Salvar Plano"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- MODAL: Editar Plano ---------------- */}
        {showEditPlanoModal && currentPlano && (
          <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 p-8 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-3xl font-bold text-lime-400 mb-6 text-center">Editar Plano</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-gray-300 text-sm font-bold mb-2">Nome</label>
                  <input
                    type="text"
                    value={editPlanoFormData.nome}
                    onChange={(e) => setEditPlanoFormData((p) => ({ ...p, nome: e.target.value }))}
                    className="w-full rounded px-3 py-2 text-gray-900 bg-gray-200"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 text-sm font-bold mb-2">Tipo</label>
                  <select
                    value={editPlanoFormData.tipo_treino}
                    onChange={(e) => setEditPlanoFormData((p) => ({ ...p, tipo_treino: e.target.value }))}
                    className="w-full rounded px-3 py-2 text-gray-900 bg-gray-200"
                  >
                    <option value="">Selecione</option>
                    <option value="Dias da Semana">Dias da Semana</option>
                    <option value="Numerico">Numérico</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-300 text-sm font-bold mb-2">Objetivo</label>
                  <select
                    value={editPlanoFormData.objetivo}
                    onChange={(e) => setEditPlanoFormData((p) => ({ ...p, objetivo: e.target.value }))}
                    className="w-full rounded px-3 py-2 text-gray-900 bg-gray-200"
                  >
                    <option value="">Selecione</option>
                    <option value="Hipertrofia">Hipertrofia</option>
                    <option value="Reducao de Gordura">Redução de Gordura</option>
                    <option value="Definicao Muscular">Definição Muscular</option>
                    <option value="Condicionamento Fisico">Condicionamento Físico</option>
                    <option value="Qualidade de Vida">Qualidade de Vida</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-300 text-sm font-bold mb-2">Dificuldade</label>
                  <select
                    value={editPlanoFormData.dificuldade}
                    onChange={(e) => setEditPlanoFormData((p) => ({ ...p, dificuldade: e.target.value }))}
                    className="w-full rounded px-3 py-2 text-gray-900 bg-gray-200"
                  >
                    <option value="">Selecione</option>
                    <option value="Adaptacao">Adaptação</option>
                    <option value="Iniciante">Iniciante</option>
                    <option value="Intermediario">Intermediário</option>
                    <option value="Avancado">Avançado</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-gray-300 text-sm font-bold mb-2">Orientações</label>
                  <textarea
                    value={editPlanoFormData.orientacao_professor}
                    onChange={(e) => setEditPlanoFormData((p) => ({ ...p, orientacao_professor: e.target.value }))}
                    className="w-full rounded px-3 py-2 text-gray-900 bg-gray-200 h-24"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseEditPlanoModal}
                  className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-full"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleUpdatePlano}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Salvando..." : "Salvar Alterações"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- MODAL: Criar Rotina ---------------- */}
        {showCreateRotinaModal && currentPlano && (
          <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 p-8 rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-3xl font-bold text-lime-400 mb-2 text-center">
                Criar Rotina para {currentPlano.nome}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                <div>
                  <label className="block text-gray-300 text-sm font-bold mb-2">Nome da Rotina</label>
                  <input
                    type="text"
                    name="nome"
                    value={rotinaFormData.nome}
                    onChange={handleRotinaFormInputChange}
                    className="w-full rounded px-3 py-2 text-gray-900 bg-gray-200"
                    placeholder="Ex: Segunda-feira"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-gray-300 text-sm font-bold mb-2">Descrição (opcional)</label>
                  <textarea
                    name="descricao"
                    value={rotinaFormData.descricao}
                    onChange={handleRotinaFormInputChange}
                    className="w-full rounded px-3 py-2 text-gray-900 bg-gray-200 h-20"
                    placeholder="Ex: Posterior e glúteos, foco em força e controle..."
                  />
                </div>
              </div>

              {/* Fonte */}
              <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-white/60 text-sm">Fonte:</span>
                  <button
                    type="button"
                    onClick={() => setFonteLista("catalogo")}
                    className={`rounded-full px-4 py-2 text-sm font-bold border border-white/10 ${
                      fonteLista === "catalogo" ? "bg-lime-600" : "bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    Catálogo Premium
                  </button>
                  <button
                    type="button"
                    onClick={() => setFonteLista("biblioteca")}
                    className={`rounded-full px-4 py-2 text-sm font-bold border border-white/10 ${
                      fonteLista === "biblioteca" ? "bg-lime-600" : "bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    Minha Biblioteca
                  </button>
                </div>

                <div className="text-white/60 text-sm">
                  Dica: escreva a descrição e clique <span className="text-white">⚡ TURBO</span> pra filtrar automático.
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Lista */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <h3 className="text-lg font-bold text-lime-300 mb-3">
                    {fonteLista === "catalogo" ? "Catálogo Premium" : "Minha Biblioteca"}
                  </h3>

                  {fonteLista === "catalogo" ? (
                    <>
                      <CatalogoToolbar mode="create" />
                      <CatalogoList mode="create" />
                    </>
                  ) : (
                    <div className="max-h-72 overflow-y-auto space-y-2">
                      {exerciciosBiblioteca.map((ex) => (
                        <div key={ex.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-white truncate">{ex.nome}</p>
                            {ex.link_youtube ? (
                              <a
                                href={ex.link_youtube}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-white/60 hover:text-white/80 underline"
                              >
                                Ver vídeo
                              </a>
                            ) : (
                              <span className="text-xs text-white/40">Sem vídeo</span>
                            )}
                          </div>

                          <button
                            onClick={() => addExercicioBibliotecaToRotinaModal(ex)}
                            className="rounded-full bg-green-600 hover:bg-green-700 px-3 py-1 text-sm"
                            type="button"
                          >
                            + Add
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Exercícios da rotina */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-lime-300">Exercícios da Rotina</h3>
                    <span className="text-white/60 text-sm">{exerciciosNaRotinaModal.length} itens</span>
                  </div>

                  {exerciciosNaRotinaModal.length === 0 ? (
                    <p className="text-white/60">Adicione exercícios ao lado.</p>
                  ) : (
                    <div className="max-h-72 overflow-y-auto space-y-3">
                      {clampOrder(exerciciosNaRotinaModal).map((ex) => (
                        <div key={ex.id} className="rounded-lg bg-white/5 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold truncate">
                                {ex.ordem}. {ex.nomeExercicio}{" "}
                                <span className="text-xs text-white/50">
                                  ({ex.origem === "catalogo" ? "Catálogo" : "Minha biblioteca"})
                                </span>
                              </p>
                              {ex.link_video ? (
                                <a
                                  href={ex.link_video}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-white/60 hover:text-white/80 underline"
                                >
                                  Ver vídeo
                                </a>
                              ) : (
                                <span className="text-xs text-white/40">Sem vídeo</span>
                              )}
                            </div>

                            <button
                              onClick={() => removeExercicioNaRotinaModal(ex.id)}
                              className="rounded-full bg-red-600 hover:bg-red-700 px-3 py-1 text-sm"
                              type="button"
                            >
                              Remover
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2 mt-3">
                            <input
                              type="number"
                              value={ex.series ?? ""}
                              onChange={(e) =>
                                updateExercicioNaRotinaModal(ex.id, "series", Number(e.target.value) || null)
                              }
                              className="rounded bg-gray-200 text-gray-900 px-2 py-1"
                              placeholder="Séries"
                              min={0}
                            />
                            <input
                              type="text"
                              value={ex.repeticoes ?? ""}
                              onChange={(e) => updateExercicioNaRotinaModal(ex.id, "repeticoes", e.target.value)}
                              className="rounded bg-gray-200 text-gray-900 px-2 py-1"
                              placeholder="Reps (8-12)"
                            />
                            <input
                              type="text"
                              value={ex.carga ?? ""}
                              onChange={(e) => updateExercicioNaRotinaModal(ex.id, "carga", e.target.value)}
                              className="rounded bg-gray-200 text-gray-900 px-2 py-1"
                              placeholder="Carga"
                            />
                            <input
                              type="text"
                              value={ex.intervalo ?? ""}
                              onChange={(e) => updateExercicioNaRotinaModal(ex.id, "intervalo", e.target.value)}
                              className="rounded bg-gray-200 text-gray-900 px-2 py-1"
                              placeholder="Intervalo (60s)"
                            />
                            <textarea
                              value={ex.observacoes ?? ""}
                              onChange={(e) => updateExercicioNaRotinaModal(ex.id, "observacoes", e.target.value)}
                              className="col-span-2 rounded bg-gray-200 text-gray-900 px-2 py-1"
                              placeholder="Observações"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={handleCloseCreateRotinaModal}
                  className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-full"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleCreateRotina}
                  className="bg-lime-600 hover:bg-lime-700 text-white font-bold py-2 px-6 rounded-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Criando..." : "Salvar Rotina"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- MODAL: Editar Rotina ---------------- */}
        {showEditRotinaModal && currentPlano && currentRotina && (
          <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 p-8 rounded-2xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold text-lime-400">Editar Rotina</h2>
                  <p className="text-white/60 mt-1">
                    Plano: <span className="text-white">{currentPlano.nome}</span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCloseEditRotinaModal}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
                >
                  Fechar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                <div>
                  <label className="block text-gray-300 text-sm font-bold mb-2">Nome da Rotina</label>
                  <input
                    type="text"
                    value={editRotinaFormData.nome}
                    onChange={(e) => setEditRotinaFormData((p) => ({ ...p, nome: e.target.value }))}
                    className="w-full rounded px-3 py-2 text-gray-900 bg-gray-200"
                    placeholder="Ex: Treino A"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-gray-300 text-sm font-bold mb-2">Descrição (opcional)</label>
                  <textarea
                    value={editRotinaFormData.descricao}
                    onChange={(e) => setEditRotinaFormData((p) => ({ ...p, descricao: e.target.value }))}
                    className="w-full rounded px-3 py-2 text-gray-900 bg-gray-200 h-20"
                    placeholder="Ex: foco em posterior, cadência controlada..."
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-white/60 text-sm">Fonte:</span>
                  <button
                    type="button"
                    onClick={() => setFonteLista("catalogo")}
                    className={`rounded-full px-4 py-2 text-sm font-bold border border-white/10 ${
                      fonteLista === "catalogo" ? "bg-lime-600" : "bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    Catálogo Premium
                  </button>
                  <button
                    type="button"
                    onClick={() => setFonteLista("biblioteca")}
                    className={`rounded-full px-4 py-2 text-sm font-bold border border-white/10 ${
                      fonteLista === "biblioteca" ? "bg-lime-600" : "bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    Minha Biblioteca
                  </button>
                </div>

                <div className="text-white/60 text-sm">
                  Use <span className="text-white">⚡ TURBO</span> pra filtrar automático pela descrição.
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Fonte */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <h3 className="text-lg font-bold text-lime-300 mb-3">
                    {fonteLista === "catalogo" ? "Catálogo Premium" : "Minha Biblioteca"}
                  </h3>

                  {fonteLista === "catalogo" ? (
                    <>
                      <CatalogoToolbar mode="edit" />
                      <CatalogoList mode="edit" />
                    </>
                  ) : (
                    <div className="max-h-72 overflow-y-auto space-y-2">
                      {exerciciosBiblioteca.map((ex) => (
                        <div key={ex.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-white truncate">{ex.nome}</p>
                            {ex.link_youtube ? (
                              <a
                                href={ex.link_youtube}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-white/60 hover:text-white/80 underline"
                              >
                                Ver vídeo
                              </a>
                            ) : (
                              <span className="text-xs text-white/40">Sem vídeo</span>
                            )}
                          </div>

                          <button
                            onClick={() => addExercicioBibliotecaToEditRotinaModal(ex)}
                            className="rounded-full bg-green-600 hover:bg-green-700 px-3 py-1 text-sm"
                            type="button"
                          >
                            + Add
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Exercícios */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-lime-300">Exercícios da Rotina</h3>
                    <span className="text-white/60 text-sm">{exerciciosNaEdicaoDeRotinaModal.length} itens</span>
                  </div>

                  {exerciciosNaEdicaoDeRotinaModal.length === 0 ? (
                    <p className="text-white/60">Adicione exercícios ao lado.</p>
                  ) : (
                    <div className="max-h-72 overflow-y-auto space-y-3">
                      {clampOrder(exerciciosNaEdicaoDeRotinaModal).map((ex) => (
                        <div key={ex.id} className="rounded-lg bg-white/5 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold truncate">
                                {ex.ordem}. {ex.nomeExercicio}{" "}
                                <span className="text-xs text-white/50">
                                  ({ex.origem === "catalogo" ? "Catálogo" : "Minha biblioteca"})
                                </span>
                              </p>

                              {ex.link_video ? (
                                <a
                                  href={ex.link_video}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-white/60 hover:text-white/80 underline"
                                >
                                  Ver vídeo
                                </a>
                              ) : (
                                <span className="text-xs text-white/40">Sem vídeo</span>
                              )}
                            </div>

                            <div className="flex gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => moveExercicio(ex.id, "up")}
                                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm hover:bg-white/10"
                                title="Subir"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                onClick={() => moveExercicio(ex.id, "down")}
                                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm hover:bg-white/10"
                                title="Descer"
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                onClick={() => removeExercicioNaEdicaoDeRotinaModal(ex.id)}
                                className="rounded-full bg-red-600 hover:bg-red-700 px-3 py-1 text-sm"
                              >
                                Remover
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 mt-3">
                            <input
                              type="number"
                              value={ex.series ?? ""}
                              onChange={(e) =>
                                updateExercicioNaEdicaoDeRotinaModal(ex.id, "series", Number(e.target.value) || null)
                              }
                              className="rounded bg-gray-200 text-gray-900 px-2 py-1"
                              placeholder="Séries"
                              min={0}
                            />
                            <input
                              type="text"
                              value={ex.repeticoes ?? ""}
                              onChange={(e) => updateExercicioNaEdicaoDeRotinaModal(ex.id, "repeticoes", e.target.value)}
                              className="rounded bg-gray-200 text-gray-900 px-2 py-1"
                              placeholder="Reps (8-12)"
                            />
                            <input
                              type="text"
                              value={ex.carga ?? ""}
                              onChange={(e) => updateExercicioNaEdicaoDeRotinaModal(ex.id, "carga", e.target.value)}
                              className="rounded bg-gray-200 text-gray-900 px-2 py-1"
                              placeholder="Carga"
                            />
                            <input
                              type="text"
                              value={ex.intervalo ?? ""}
                              onChange={(e) => updateExercicioNaEdicaoDeRotinaModal(ex.id, "intervalo", e.target.value)}
                              className="rounded bg-gray-200 text-gray-900 px-2 py-1"
                              placeholder="Intervalo (60s)"
                            />
                            <textarea
                              value={ex.observacoes ?? ""}
                              onChange={(e) => updateExercicioNaEdicaoDeRotinaModal(ex.id, "observacoes", e.target.value)}
                              className="col-span-2 rounded bg-gray-200 text-gray-900 px-2 py-1"
                              placeholder="Observações"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap justify-between gap-3 mt-6">
                <button
                  type="button"
                  onClick={handleDeleteRotina}
                  className="bg-red-700 hover:bg-red-800 text-white font-bold py-2 px-6 rounded-full"
                  disabled={isSubmitting}
                >
                  Deletar Rotina
                </button>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleCloseEditRotinaModal}
                    className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-full"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={handleUpdateRotina}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Salvando..." : "Salvar Alterações"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}