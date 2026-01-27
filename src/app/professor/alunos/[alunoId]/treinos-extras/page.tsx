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

  const [professorId, setProfessorId] = useState<string | null>(null);
  const [alunoNome, setAlunoNome] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      // 1) precisa estar logado
      const { data: auth, error: authError } = await supabase.auth.getUser();
      const user = auth?.user;

      if (authError || !user) {
        router.push("/login");
        return;
      }

      // 2) precisa ser professor (lendo do profiles.role)
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", user.id)
        .single();

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

      setProfessorId(prof.id);

      // 3) valida o aluno (tem que existir e estar vinculado a este professor)
      if (!alunoId) {
        setError("Aluno inválido.");
        setLoading(false);
        return;
      }

      const { data: aluno, error: alunoErr } = await supabase
        .from("profiles")
        .select("id, nome_completo, professor_id, role")
        .eq("id", alunoId)
        .single();

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
      setLoading(false);
    })();
  }, [alunoId, router]);

  const handleSuccess = () => {
    alert("Treino extra enviado com sucesso!");
  };

  const handleError = (message: string) => {
    setError(message);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center text-lime-400 text-2xl">
        Carregando página...
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-red-500 text-lg p-4">
        <p className="text-center">{error}</p>
        <div className="mt-4 flex gap-2">
          <Link
            href="/professor/alunos"
            className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-full transition duration-300"
          >
            ← Voltar para Alunos
          </Link>
          <Link
            href="/professor/dashboard"
            className="bg-lime-500 hover:bg-lime-400 text-black font-bold py-2 px-4 rounded-full transition duration-300"
          >
            Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-8">
          <div>
            <p className="text-white/60 text-sm">Motion</p>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-lime-300">
              Treinos Extras
            </h1>
            <p className="text-white/60 mt-1">
              Enviando para: <span className="text-white">{alunoNome}</span>
            </p>
          </div>

          <Link
            href="/professor/alunos"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
          >
            ← Voltar
          </Link>
        </div>

        {error && <p className="text-red-500 text-center mb-4">{error}</p>}

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
          <MontarTreinoExtra
            alunoId={alunoId!}
            onSuccess={handleSuccess}
            onError={handleError}
          />
        </section>
      </div>
    </main>
  );
}