"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase-browser";
import { useProfessorGuard } from "@/app/professor/_guard/useProfessorGuard";

type ProfileAluno = {
  id: string;
  role: string | null;
  professor_id: string | null;
  nome_completo: string | null;
  email: string | null;
  telefone: string | null;
  bio: string | null;
  instagram: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  ativo: boolean | null;
};

export default function ProfessorVerPerfilAlunoPage() {
  const router = useRouter();
  const params = useParams<{ alunoId: string }>();
  const alunoId = params?.alunoId;

  const { ok, loading: guardLoading } = useProfessorGuard();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profId, setProfId] = useState<string | null>(null);
  const [aluno, setAluno] = useState<ProfileAluno | null>(null);

  useEffect(() => {
    if (guardLoading) return;
    if (!ok) return;

    (async () => {
      setLoading(true);
      setError(null);

      // professor id (auth)
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) {
        router.push("/login");
        return;
      }
      setProfId(user.id);

      // aluno profile
      const { data, error: pErr } = await supabase
        .from("profiles")
        .select(
          "id, role, professor_id, nome_completo, email, telefone, bio, instagram, avatar_url, cover_url, ativo"
        )
        .eq("id", alunoId)
        .single();

      if (pErr || !data) {
        setError("Não foi possível carregar o perfil do aluno.");
        setLoading(false);
        return;
      }

      // valida: aluno pertence ao professor logado
      if ((data.role || "").toLowerCase() !== "aluno" || data.professor_id !== user.id) {
        setError("Acesso negado: este aluno não pertence a você.");
        setLoading(false);
        return;
      }

      setAluno(data as ProfileAluno);
      setLoading(false);
    })();
  }, [ok, guardLoading, alunoId, router]);

  if (guardLoading || loading) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-lime-300 text-lg">Carregando…</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
        <div className="max-w-xl w-full rounded-3xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-xl font-bold text-red-200">Erro</h1>
          <p className="mt-2 text-white/70">{error}</p>
          <div className="mt-4 flex gap-2">
            <Link
              href="/professor/alunos"
              className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-white/80 hover:bg-white/10 transition"
            >
              Voltar para Alunos
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const nome = aluno?.nome_completo || "Aluno";
  const initials = nome.trim().slice(0, 1).toUpperCase();

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* Top bar */}
      <div className="sticky top-0 z-50 border-b border-white/10 bg-black/60 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <Link
            href={`/professor/alunos/${alunoId}/detalhes`}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
          >
            ← Voltar para o aluno
          </Link>

          <div className="text-sm text-white/60">Perfil do aluno</div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 pb-16">
        <div className="rounded-3xl border border-white/10 bg-white/5 overflow-hidden">
          {/* cover */}
          <div className="relative h-48 sm:h-56 bg-black/40">
            {aluno?.cover_url ? (
              <Image src={aluno.cover_url} alt="Capa" fill className="object-cover" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-black via-black to-lime-500/10" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

            <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4">
              <div className="flex items-end gap-4 min-w-0">
                <div className="relative h-20 w-20 sm:h-24 sm:w-24 rounded-2xl overflow-hidden border border-white/10 bg-black/40">
                  {aluno?.avatar_url ? (
                    <Image src={aluno.avatar_url} alt="Avatar" fill className="object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-lime-300 font-extrabold text-2xl">
                      {initials}
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <h1 className="text-2xl sm:text-3xl font-extrabold truncate">{nome}</h1>
                  <p className="text-white/60 text-sm truncate">{aluno?.email || ""}</p>
                </div>
              </div>

              <Link
                href={`/professor/alunos/${alunoId}/atribuir-treino`}
                className="rounded-2xl bg-lime-500 px-4 py-2 text-sm font-semibold text-black hover:bg-lime-400 transition"
              >
                Atribuir treino
              </Link>
            </div>
          </div>

          {/* body */}
          <div className="p-6 sm:p-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
              <h2 className="font-bold text-lime-200">Contato</h2>
              <p className="mt-2 text-white/70 text-sm">Email: <span className="text-white">{aluno?.email || "—"}</span></p>
              <p className="mt-1 text-white/70 text-sm">Telefone: <span className="text-white">{aluno?.telefone || "—"}</span></p>
              <p className="mt-1 text-white/70 text-sm">
                Instagram: <span className="text-white">{aluno?.instagram || "—"}</span>
              </p>
              <p className="mt-3 text-xs text-white/40">
                Status: {aluno?.ativo === false ? "Inativo" : "Ativo"}
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
              <h2 className="font-bold text-lime-200">Bio</h2>
              <p className="mt-2 text-white/70 whitespace-pre-wrap">
                {aluno?.bio || "Sem bio ainda."}
              </p>
            </div>

            <div className="md:col-span-2 flex flex-wrap gap-2">
              <Link
                href={`/professor/alunos/${alunoId}/anamnese`}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition"
              >
                Anamnese
              </Link>
              <Link
                href={`/professor/alunos/${alunoId}/treinos-extras`}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition"
              >
                Treinos extras
              </Link>
              <Link
                href={`/professor/alunos/${alunoId}/financeiro`}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition"
              >
                Financeiro
              </Link>
              <Link
                href={`/professor/alunos/${alunoId}/progresso-aluno`}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition"
              >
                Progresso
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}