"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/utils/supabase-browser";

// --- Interfaces de Dados ---
interface Exercicio {
  id: string;
  nome: string;
  descricao: string | null;
  link_youtube: string | null;
  professor_id: string;
}

interface TreinoExercicioData {
  rotina_id: string;
  exercicio_id: string;
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

// --- Utils ---
function normalizeStr(v: string | null | undefined) {
  return (v || "").toLowerCase().trim();
}

function clampOrder(list: TreinoExercicioDisplay[]) {
  return list
    .slice()
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
    .map((item, idx) => ({ ...item, ordem: idx + 1 }));
}

export default function ProfessorTreinosPage() {
  const router = useRouter();

  // Estados de Carregamento e Erro
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dados Globais
  const [professorId, setProfessorId] = useState<string | null>(null);
  const [exerciciosBiblioteca, setExerciciosBiblioteca] = useState<Exercicio[]>([]);
  const [planosTreino, setPlanosTreino] = useState<PlanoTreino[]>([]);

  // Busca / Filtro premium simples
  const [busca, setBusca] = useState("");

  // Modais
  const [showCreatePlanoModal, setShowCreatePlanoModal] = useState(false);
  const [showEditPlanoModal, setShowEditPlanoModal] = useState(false);
  const [showCreateRotinaModal, setShowCreateRotinaModal] = useState(false);
  const [showEditRotinaModal, setShowEditRotinaModal] = useState(false);

  // Atual contexto
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
  const [exerciciosNaRotinaModal, setExerciciosNaRotinaModal] = useState<TreinoExercicioDisplay[]>([]);
  const [exerciciosNaEdicaoDeRotinaModal, setExerciciosNaEdicaoDeRotinaModal] = useState<TreinoExercicioDisplay[]>([]);

  // ----------------------------------
  // Auth + fetch
  // ----------------------------------
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
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

      const { data: planosTreinoRawData, error: planosTreinoError } = await supabase
        .from("treinos")
        .select(`
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
              ordem,
              series,
              repeticoes,
              carga,
              intervalo,
              observacoes
            )
          )
        `)
        .eq("professor_id", pId)
        .order("created_at", { ascending: false });

      if (planosTreinoError) throw planosTreinoError;

      const formatted: PlanoTreino[] = (planosTreinoRawData || []).map((plano: any) => ({
        ...plano,
        rotinas_diarias: (plano.rotinas_diarias || []).map((rotina: any) => ({
          ...rotina,
          treino_exercicios: rotina.treino_exercicios || [],
        })),
      }));

      setPlanosTreino(formatted);
    } catch (err: any) {
      console.error("Erro ao buscar dados:", err?.message);
      setError("Erro ao carregar dados: " + (err?.message || "desconhecido"));
    } finally {
      setLoading(false);
    }
  }

  // ----------------------------------
  // Handlers de input
  // ----------------------------------
  const handlePlanoFormInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setPlanoFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRotinaFormInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setRotinaFormData((prev) => ({ ...prev, [name]: value }));
  };

  // ----------------------------------
  // Plano: criar / editar / deletar
  // ----------------------------------
  const handleOpenCreatePlanoModal = () => {
    setPlanoFormData({ nome: "", descricao: "", tipo_treino: "", objetivo: "", dificuldade: "", orientacao_professor: "" });
    setError(null);
    setShowCreatePlanoModal(true);
  };

  const handleCloseCreatePlanoModal = () => {
    setShowCreatePlanoModal(false);
    setError(null);
  };

  const handleCreatePlano = async () => {
    if (!planoFormData.nome.trim() || !planoFormData.tipo_treino || !planoFormData.objetivo || !planoFormData.dificuldade) {
      setError("Preencha os obrigatórios do Plano (Nome, Tipo, Objetivo, Dificuldade).");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { error: planoError } = await supabase
        .from("treinos")
        .insert({
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

    if (!editPlanoFormData.nome.trim() || !editPlanoFormData.tipo_treino || !editPlanoFormData.objetivo || !editPlanoFormData.dificuldade) {
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

  // ----------------------------------
  // Rotina: criar
  // ----------------------------------
  const handleOpenCreateRotinaModal = (plano: PlanoTreino) => {
    setCurrentPlano(plano);
    setRotinaFormData({ nome: "", descricao: "" });
    setExerciciosNaRotinaModal([]);
    setError(null);
    setShowCreateRotinaModal(true);
  };

  const handleCloseCreateRotinaModal = () => {
    setShowCreateRotinaModal(false);
    setCurrentPlano(null);
    setRotinaFormData({ nome: "", descricao: "" });
    setExerciciosNaRotinaModal([]);
    setError(null);
  };

  const addExercicioToRotinaModal = (exercicio: Exercicio) => {
    setExerciciosNaRotinaModal((prev) => {
      if (prev.find((x) => x.exercicio_id === exercicio.id)) {
        setError("Este exercício já foi adicionado à rotina.");
        return prev;
      }
      setError(null);

      return [
        ...prev,
        {
          id: uuidv4(),
          nomeExercicio: exercicio.nome,
          exercicio_id: exercicio.id,
          rotina_id: "",
          ordem: prev.length + 1,
          series: null,
          repeticoes: "",
          carga: "",
          intervalo: "",
          observacoes: "",
        },
      ];
    });
  };

  const updateExercicioNaRotinaModal = (idLocal: string, field: keyof TreinoExercicioDisplay, value: any) => {
    setExerciciosNaRotinaModal((prev) => prev.map((ex) => (ex.id === idLocal ? { ...ex, [field]: value } : ex)));
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
        exercicio_id: ex.exercicio_id,
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

  // ----------------------------------
  // Rotina: editar (premium)
  // ----------------------------------
  const handleOpenEditRotinaModal = async (plano: PlanoTreino, rotina: RotinaDiaria) => {
    setCurrentPlano(plano);
    setCurrentRotina(rotina);
    setEditRotinaFormData({ nome: rotina.nome, descricao: rotina.descricao || "" });
    setError(null);
    setShowEditRotinaModal(true);

    // Monta lista editável com nome do exercício
    const base = (rotina.treino_exercicios || []).map((te) => {
      const ex = exerciciosBiblioteca.find((e) => e.id === te.exercicio_id);
      return {
        id: uuidv4(),
        nomeExercicio: ex?.nome || "Exercício",
        rotina_id: rotina.id,
        exercicio_id: te.exercicio_id,
        ordem: te.ordem,
        series: te.series,
        repeticoes: te.repeticoes,
        carga: te.carga,
        intervalo: te.intervalo,
        observacoes: te.observacoes,
      } as TreinoExercicioDisplay;
    });

    setExerciciosNaEdicaoDeRotinaModal(clampOrder(base));
  };

  const handleCloseEditRotinaModal = () => {
    setShowEditRotinaModal(false);
    setCurrentPlano(null);
    setCurrentRotina(null);
    setEditRotinaFormData({ nome: "", descricao: "" });
    setExerciciosNaEdicaoDeRotinaModal([]);
    setError(null);
  };

  const addExercicioToEditRotinaModal = (exercicio: Exercicio) => {
    setExerciciosNaEdicaoDeRotinaModal((prev) => {
      if (prev.find((x) => x.exercicio_id === exercicio.id)) {
        setError("Este exercício já está nesta rotina.");
        return prev;
      }
      setError(null);

      const next = [
        ...prev,
        {
          id: uuidv4(),
          nomeExercicio: exercicio.nome,
          exercicio_id: exercicio.id,
          rotina_id: currentRotina?.id || "",
          ordem: prev.length + 1,
          series: null,
          repeticoes: "",
          carga: "",
          intervalo: "",
          observacoes: "",
        },
      ];

      return clampOrder(next);
    });
  };

  const updateExercicioNaEdicaoDeRotinaModal = (idLocal: string, field: keyof TreinoExercicioDisplay, value: any) => {
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
      // 1) Atualiza a rotina (nome/descrição)
      const { error: rotinaUpdateErr } = await supabase
        .from("rotinas_diarias")
        .update({
          nome: editRotinaFormData.nome,
          descricao: editRotinaFormData.descricao || null,
        })
        .eq("id", currentRotina.id);

      if (rotinaUpdateErr) throw rotinaUpdateErr;

      // 2) Recria os exercícios (forma mais limpa e segura)
      const { error: delErr } = await supabase
        .from("treino_exercicios")
        .delete()
        .eq("rotina_id", currentRotina.id);

      if (delErr) throw delErr;

      const payload = clampOrder(exerciciosNaEdicaoDeRotinaModal).map((ex) => ({
        rotina_id: currentRotina.id,
        exercicio_id: ex.exercicio_id,
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
      const { error: delErr } = await supabase
        .from("rotinas_diarias")
        .delete()
        .eq("id", currentRotina.id);

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

  // ----------------------------------
  // Listagem filtrada (premium)
  // ----------------------------------
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

  // ----------------------------------
  // Render
  // ----------------------------------
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
                        <div key={rotina.id} className="rounded-xl border border-white/10 bg-white/5 p-3 flex items-center justify-between">
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
                  >
                    + Rotina
                  </button>
                  <button
                    onClick={() => handleOpenEditPlanoModal(plano)}
                    className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-full transition duration-300"
                  >
                    Editar Plano
                  </button>
                  <button
                    onClick={() => handleDeletePlano(plano.id)}
                    className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-full transition duration-300"
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
            <div className="bg-gray-800 p-8 rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
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
                    placeholder="Ex: Treino A, Perna, Dia 1"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-gray-300 text-sm font-bold mb-2">Descrição (opcional)</label>
                  <textarea
                    name="descricao"
                    value={rotinaFormData.descricao}
                    onChange={handleRotinaFormInputChange}
                    className="w-full rounded px-3 py-2 text-gray-900 bg-gray-200 h-20"
                  />
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <h3 className="text-lg font-bold text-lime-300 mb-3">Biblioteca</h3>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {exerciciosBiblioteca.map((ex) => (
                      <div key={ex.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                        <span className="text-white">{ex.nome}</span>
                        <button
                          onClick={() => addExercicioToRotinaModal(ex)}
                          className="rounded-full bg-green-600 hover:bg-green-700 px-3 py-1 text-sm"
                          type="button"
                        >
                          + Add
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <h3 className="text-lg font-bold text-lime-300 mb-3">Exercícios da Rotina</h3>

                  {exerciciosNaRotinaModal.length === 0 ? (
                    <p className="text-white/60">Adicione exercícios ao lado.</p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto space-y-3">
                      {clampOrder(exerciciosNaRotinaModal).map((ex) => (
                        <div key={ex.id} className="rounded-lg bg-white/5 p-3">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold">{ex.nomeExercicio}</p>
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
                              onChange={(e) => updateExercicioNaRotinaModal(ex.id, "series", Number(e.target.value) || null)}
                              className="rounded bg-gray-200 text-gray-900 px-2 py-1"
                              placeholder="Séries"
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

        {/* ---------------- MODAL: Editar Rotina (Premium) ---------------- */}
        {showEditRotinaModal && currentPlano && currentRotina && (
          <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 p-8 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
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

              {/* Nome/descrição */}
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

              {/* Biblioteca + Exercícios da rotina */}
              <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Biblioteca */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <h3 className="text-lg font-bold text-lime-300 mb-3">Adicionar da Biblioteca</h3>

                  <div className="max-h-72 overflow-y-auto space-y-2">
                    {exerciciosBiblioteca.length === 0 ? (
                      <p className="text-white/60">Sua biblioteca está vazia.</p>
                    ) : (
                      exerciciosBiblioteca.map((ex) => (
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
                            onClick={() => addExercicioToEditRotinaModal(ex)}
                            className="rounded-full bg-green-600 hover:bg-green-700 px-3 py-1 text-sm"
                            type="button"
                          >
                            + Add
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Exercícios da rotina */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-lime-300">Exercícios da Rotina</h3>
                    <span className="text-white/60 text-sm">{exerciciosNaEdicaoDeRotinaModal.length} itens</span>
                  </div>

                  {exerciciosNaEdicaoDeRotinaModal.length === 0 ? (
                    <p className="text-white/60">Adicione exercícios ao lado.</p>
                  ) : (
                    <div className="max-h-72 overflow-y-auto space-y-3">
                      {clampOrder(exerciciosNaEdicaoDeRotinaModal).map((ex, idx, arr) => (
                        <div key={ex.id} className="rounded-lg bg-white/5 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold truncate">
                                {ex.ordem}. {ex.nomeExercicio}
                              </p>
                              <p className="text-xs text-white/60">Arraste com setas para ordenar</p>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => moveExercicio(ex.id, "up")}
                                disabled={idx === 0}
                                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm hover:bg-white/10 disabled:opacity-40"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                onClick={() => moveExercicio(ex.id, "down")}
                                disabled={idx === arr.length - 1}
                                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm hover:bg-white/10 disabled:opacity-40"
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

              {/* Ações */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-6">
                <button
                  type="button"
                  onClick={handleDeleteRotina}
                  className="rounded-full bg-red-600 hover:bg-red-700 px-5 py-2 font-bold"
                  disabled={isSubmitting}
                >
                  Deletar Rotina
                </button>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleCloseEditRotinaModal}
                    className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-full"
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleUpdateRotina}
                    className="bg-lime-600 hover:bg-lime-700 text-white font-bold py-2 px-6 rounded-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Salvando..." : "Salvar Rotina"}
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