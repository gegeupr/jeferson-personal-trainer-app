// src/app/professor/alunos/[alunoId]/treinos-extras/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/utils/supabase-browser";
import MontarTreinoExtra from "@/components/MontarTreinoExtra";

export default function TreinosExtrasAlunoPage() {
  const router = useRouter();
  const params = useParams<{ alunoId: string }>();
  const alunoId = params?.alunoId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [alunoNome, setAlunoNome] = useState<string | null>(null);
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: "ok" | "err" }[]>([]);

  function pushToast(msg: string, kind: "ok" | "err") {
    const id = Date.now();
    setToasts((p) => [...p, { id, msg, kind }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3000);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      const { data: auth, error: authError } = await supabase.auth.getUser();
      const user = auth?.user;
      if (authError || !user) { router.push("/login"); return; }

      const { data: prof, error: profErr } = await supabase
        .from("profiles").select("id, role").eq("id", user.id).single();
      if (profErr || !prof) {
        setError("Não foi possível carregar seu perfil.");
        setLoading(false);
        return;
      }
      if ((prof.role || "").toLowerCase() !== "professor") {
        setError("Acesso negado. Esta página é apenas para professores.");
        setLoading(false);
        return;
      }
      if (!alunoId) {
        setError("Aluno inválido.");
        setLoading(false);
        return;
      }

      const { data: aluno, error: alunoErr } = await supabase
        .from("profiles").select("id, nome_completo, professor_id, role").eq("id", alunoId).single();
      if (alunoErr || !aluno) {
        setError("Aluno não encontrado.");
        setLoading(false);
        return;
      }
      if ((aluno.role || "").toLowerCase() !== "aluno") {
        setError("Este perfil não é um aluno.");
        setLoading(false);
        return;
      }
      if (aluno.professor_id !== prof.id) {
        setError("Acesso negado. Este aluno não está vinculado ao seu perfil.");
        setLoading(false);
        return;
      }

      setAlunoNome(aluno.nome_completo || "Aluno");
      setReady(true);
      setLoading(false);
    })();
  }, [alunoId, router]);

  const handleSuccess = () => pushToast("Treino extra enviado com sucesso!", "ok");
  const handleError = (message: string) => setError(message);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-white/40 text-sm">Carregando…</p>
      </div>
    );
  }

  if (error && !ready) {
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
          <span className="text-white/60">Treinos extras</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-white">Treinos extras</h1>
          <p className="text-white/50 text-sm mt-1">Enviando para: {alunoNome}</p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-400/15 bg-red-400/8 px-4 py-3 text-sm text-red-300">{error}</div>
        )}

        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <MontarTreinoExtra
            alunoId={alunoId!}
            onSuccess={handleSuccess}
            onError={handleError}
          />
        </div>
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
    </main>
  );
}
