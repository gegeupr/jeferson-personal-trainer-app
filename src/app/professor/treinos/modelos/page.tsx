"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase-browser";
import { atribuirModeloAoAluno } from "@/app/actions/gemini-treino";

interface Modelo {
  id: string;
  nome: string;
  descricao: string | null;
  perfil_origem: string | null;
  dificuldade: string | null;
}

interface AlunoOption {
  id: string;
  nome_completo: string | null;
}

export default function ModelosPage() {
  const router = useRouter();
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [alunos, setAlunos] = useState<AlunoOption[]>([]);
  const [profId, setProfId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [atribuindo, setAtribuindo] = useState<string | null>(null);
  const [alunoSelecionado, setAlunoSelecionado] = useState<Record<string, string>>({});

  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: "ok" | "err" }[]>([]);
  const [confirmState, setConfirmState] = useState<{ msg: string; onOk: () => void } | null>(null);

  function pushToast(msg: string, kind: "ok" | "err") {
    const id = Date.now();
    setToasts((p) => [...p, { id, msg, kind }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
  }

  function showConfirm(msg: string, onOk: () => void) {
    setConfirmState({ msg, onOk });
  }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: profile } = await supabase
        .from("profiles").select("role").eq("id", user.id).single();
      if (profile?.role !== "professor") { router.push("/dashboard"); return; }

      setProfId(user.id);
      await fetchData(user.id);
    })();
  }, [router]);

  async function fetchData(pid: string) {
    setLoading(true);
    setErro(null);
    try {
      const [modelosRes, alunosRes] = await Promise.all([
        supabase
          .from("treinos")
          .select("id, nome, descricao, perfil_origem, dificuldade")
          .eq("professor_id", pid)
          .eq("is_template", true)
          .order("created_at", { ascending: false }),

        supabase
          .from("profiles")
          .select("id, nome_completo")
          .eq("professor_id", pid)
          .eq("role", "aluno")
          .order("nome_completo"),
      ]);

      if (modelosRes.error) throw modelosRes.error;
      if (alunosRes.error) throw alunosRes.error;

      setModelos((modelosRes.data as Modelo[]) || []);
      setAlunos((alunosRes.data as AlunoOption[]) || []);
    } catch (e: any) {
      setErro(e?.message ?? "Erro ao carregar modelos.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAtribuir(modeloId: string) {
    const alunoId = alunoSelecionado[modeloId];
    if (!alunoId || !profId) return;

    setAtribuindo(modeloId);
    try {
      const result = await atribuirModeloAoAluno(modeloId, alunoId, profId);
      if (!result.ok) { pushToast(result.error, "err"); return; }
      pushToast("Modelo atribuído! Redirecionando para edição…", "ok");
      setTimeout(() => {
        router.push(`/professor/alunos/${alunoId}/treino/${result.treinoId}`);
      }, 1000);
    } finally {
      setAtribuindo(null);
    }
  }

  async function handleExcluir(modelo: Modelo) {
    showConfirm(`Excluir o modelo "${modelo.nome}"? Esta ação não pode ser desfeita.`, async () => {
      try {
        const { data: rotinas } = await supabase
          .from("rotinas_diarias").select("id").eq("plano_id", modelo.id);
        const rotinaIds = (rotinas || []).map((r) => r.id);
        if (rotinaIds.length > 0) {
          await supabase.from("treino_exercicios").delete().in("rotina_id", rotinaIds);
        }
        await supabase.from("rotinas_diarias").delete().eq("plano_id", modelo.id);
        const { error } = await supabase.from("treinos").delete().eq("id", modelo.id);
        if (error) throw error;
        setModelos((p) => p.filter((m) => m.id !== modelo.id));
        pushToast("Modelo excluído.", "ok");
      } catch (e: any) {
        pushToast(e?.message ?? "Erro ao excluir.", "err");
      }
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-white/40 text-sm">Carregando modelos…</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-white/40">
          <Link href="/professor/treinos" className="hover:text-white/70 transition-colors">Treinos</Link>
          <span>/</span>
          <span className="text-white/60">Modelos IA</span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Modelos de treino IA</h1>
            <p className="mt-1 text-sm text-white/50">
              Templates reutilizáveis gerados por IA. Aplique a qualquer aluno com um clique.
            </p>
          </div>
          <Link
            href="/professor/treinos/gerar-modelo"
            className="shrink-0 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-white/90 transition-colors"
          >
            + Novo modelo
          </Link>
        </div>

        {erro && (
          <p className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">{erro}</p>
        )}

        {modelos.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-10 text-center">
            <p className="text-white/40 text-sm">Nenhum modelo criado ainda.</p>
            <Link
              href="/professor/treinos/gerar-modelo"
              className="mt-4 inline-block rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black hover:bg-white/90 transition-colors"
            >
              Gerar primeiro modelo
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {modelos.map((modelo) => (
              <div key={modelo.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-semibold text-white truncate">{modelo.nome}</h2>
                      <span className="shrink-0 rounded-full border border-white/15 bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-white/60">
                        Modelo IA
                      </span>
                      {modelo.dificuldade && (
                        <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-white/40 capitalize">
                          {modelo.dificuldade}
                        </span>
                      )}
                    </div>
                    {modelo.perfil_origem && (
                      <p className="mt-1 text-xs text-white/40 line-clamp-2">{modelo.perfil_origem}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/professor/treinos/modelos/${modelo.id}`}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 hover:bg-white/10 transition-colors"
                    >
                      Ver / Editar
                    </Link>
                    <button
                      onClick={() => handleExcluir(modelo)}
                      className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-400/15 transition-colors"
                    >
                      Excluir
                    </button>
                  </div>
                </div>

                {/* Atribuir a aluno */}
                <div className="flex items-center gap-2 pt-1 border-t border-white/6">
                  <select
                    value={alunoSelecionado[modelo.id] ?? ""}
                    onChange={(e) => setAlunoSelecionado((p) => ({ ...p, [modelo.id]: e.target.value }))}
                    className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/25 transition-colors"
                  >
                    <option value="" className="bg-[#111]">Selecionar aluno…</option>
                    {alunos.map((a) => (
                      <option key={a.id} value={a.id} className="bg-[#111]">
                        {a.nome_completo || "Aluno sem nome"}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleAtribuir(modelo.id)}
                    disabled={!alunoSelecionado[modelo.id] || atribuindo === modelo.id}
                    className="shrink-0 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {atribuindo === modelo.id ? "Atribuindo…" : "Atribuir"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {toasts.length > 0 && (
        <div className="fixed bottom-24 lg:bottom-6 right-4 z-[100] flex flex-col gap-2 max-w-sm">
          {toasts.map((t) => (
            <div key={t.id} className={`rounded-xl px-4 py-3 text-sm font-medium shadow-xl border ${
              t.kind === "ok" ? "bg-white text-black border-transparent" : "bg-red-500/10 text-red-200 border-red-500/20"
            }`}>{t.msg}</div>
          ))}
        </div>
      )}

      {confirmState && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-6 max-w-sm w-full">
            <p className="text-white text-sm">{confirmState.msg}</p>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setConfirmState(null)} className="border border-white/10 bg-white/5 px-4 py-2 rounded-xl text-sm text-white/70 hover:bg-white/10 transition-colors">Cancelar</button>
              <button onClick={() => { confirmState.onOk(); setConfirmState(null); }} className="bg-white text-black px-4 py-2 rounded-xl text-sm font-semibold hover:bg-white/90 transition-colors">Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
