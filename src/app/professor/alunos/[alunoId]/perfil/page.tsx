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
  const [aluno, setAluno] = useState<ProfileAluno | null>(null);

  useEffect(() => {
    if (guardLoading || !ok) return;

    (async () => {
      setLoading(true);
      setError(null);

      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) { router.push("/login"); return; }

      const { data, error: pErr } = await supabase
        .from("profiles")
        .select("id, role, professor_id, nome_completo, email, telefone, bio, instagram, avatar_url, cover_url, ativo")
        .eq("id", alunoId)
        .single();

      if (pErr || !data) {
        setError("Não foi possível carregar o perfil do aluno.");
        setLoading(false);
        return;
      }

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
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-white/40 text-sm">Carregando…</p>
      </div>
    );
  }

  if (error) {
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

  const nome = aluno?.nome_completo || "Aluno";
  const initials = nome.trim().slice(0, 1).toUpperCase();

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-white/40">
          <Link href="/professor/alunos" className="hover:text-white/70 transition-colors">Alunos</Link>
          <span>/</span>
          <Link href={`/professor/alunos/${alunoId}/detalhes`} className="hover:text-white/70 transition-colors">{nome}</Link>
          <span>/</span>
          <span className="text-white/60">Perfil</span>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.03] overflow-hidden">
          {/* cover */}
          <div className="relative h-44 bg-black/40">
            {aluno?.cover_url ? (
              <Image src={aluno.cover_url} alt="Capa" fill className="object-cover opacity-80" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent" />
            )}
            <div className="absolute inset-0 bg-black/50" />
          </div>

          <div className="px-6 pb-6 -mt-8">
            <div className="flex items-end justify-between gap-4">
              <div className="flex items-end gap-4">
                <div className="relative h-16 w-16 rounded-xl overflow-hidden border border-white/10 bg-[#0a0a0a] shrink-0">
                  {aluno?.avatar_url ? (
                    <Image src={aluno.avatar_url} alt="Avatar" fill className="object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-white font-bold text-xl">{initials}</div>
                  )}
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-white">{nome}</h1>
                  <p className="text-white/50 text-sm">{aluno?.email || ""}</p>
                </div>
              </div>

              <Link
                href={`/professor/alunos/${alunoId}/atribuir-treino`}
                className="shrink-0 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 transition-colors"
              >
                Atribuir treino
              </Link>
            </div>
          </div>

          <div className="px-6 pb-6 grid gap-4 md:grid-cols-2 border-t border-white/8 pt-5">
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
              <h2 className="text-xs font-medium text-white/50 mb-3">Contato</h2>
              <div className="space-y-1.5 text-sm">
                <p className="text-white/60">Email: <span className="text-white/80">{aluno?.email || "—"}</span></p>
                <p className="text-white/60">Telefone: <span className="text-white/80">{aluno?.telefone || "—"}</span></p>
                <p className="text-white/60">Instagram: <span className="text-white/80">{aluno?.instagram || "—"}</span></p>
                <p className="text-white/40 text-xs mt-2">Status: {aluno?.ativo === false ? "Inativo" : "Ativo"}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
              <h2 className="text-xs font-medium text-white/50 mb-3">Bio</h2>
              <p className="text-sm text-white/70 whitespace-pre-wrap">{aluno?.bio || "Sem bio ainda."}</p>
            </div>

            <div className="md:col-span-2 flex flex-wrap gap-2">
              {[
                { href: "anamnese", label: "Anamnese" },
                { href: "treinos-extras", label: "Treinos extras" },
                { href: "financeiro", label: "Financeiro" },
                { href: "progresso-aluno", label: "Progresso" },
              ].map(({ href, label }) => (
                <Link key={href} href={`/professor/alunos/${alunoId}/${href}`}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 hover:bg-white/10 transition-colors">
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
