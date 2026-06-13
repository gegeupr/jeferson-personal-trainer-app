"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/utils/supabase-browser";

const WELCOME_PENDING_KEY = "motion_welcome_pending";

type ProfessorPublic = {
  nome_completo: string | null;
  slug: string | null;
  avatar_url: string | null;
  cover_url: string | null;
};

export default function BemVindoAlunoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [professor, setProfessor] = useState<ProfessorPublic | null>(null);

  const profName = useMemo(() => professor?.nome_completo || "seu professor", [professor?.nome_completo]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const pending = localStorage.getItem(WELCOME_PENDING_KEY);
      if (!pending) {
        router.replace("/aluno/dashboard");
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: alunoProfile } = await supabase
        .from("profiles")
        .select("professor_id, role")
        .eq("id", user.id)
        .single();

      if (!alunoProfile || alunoProfile.role !== "aluno") {
        router.replace("/dashboard");
        return;
      }

      if (alunoProfile.professor_id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("nome_completo, slug, avatar_url, cover_url")
          .eq("id", alunoProfile.professor_id)
          .single();

        if (mounted) setProfessor((prof as any) || null);
      }

      if (mounted) setLoading(false);
    }

    load();

    return () => {
      mounted = false;
    };
  }, [router]);

  function handleContinue() {
    localStorage.removeItem(WELCOME_PENDING_KEY);
    router.replace("/aluno/dashboard");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <p className="text-white/40 text-sm">Preparando seu Motion…</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] overflow-hidden shadow-2xl">
          {/* Capa */}
          <div className="relative h-56 w-full bg-black/40">
            {professor?.cover_url ? (
              <Image
                src={professor.cover_url}
                alt="Capa do professor"
                fill
                className="object-cover opacity-80"
                priority
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent" />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/50 to-black/90" />

            {/* Avatar */}
            <div className="absolute left-6 bottom-[-34px]">
              <div className="relative h-20 w-20 rounded-2xl overflow-hidden border border-white/10 bg-black/40">
                {professor?.avatar_url ? (
                  <Image src={professor.avatar_url} alt="Avatar" fill className="object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-white font-extrabold text-2xl">
                    {(profName.slice(0, 1) || "M").toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Conteúdo */}
          <div className="pt-12 px-6 pb-6">
            <p className="text-white/50 text-sm">Bem-vindo ao</p>
            <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              Motion
            </h1>

            <div className="mt-4 rounded-2xl border border-white/8 bg-black/40 p-5">
              <p className="text-lg sm:text-xl font-semibold text-white">
                Você agora treina com o <span className="font-bold">Prof. {profName}</span> — bem-vindo ao Motion.
              </p>
              <p className="mt-2 text-sm text-white/50">
                Seu acesso já está ativo e seus treinos, progresso e arquivos ficam organizados no seu dashboard.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleContinue}
                className="rounded-xl bg-white px-5 py-4 font-bold text-black hover:bg-white/90 transition-colors"
              >
                Entrar no meu dashboard
              </button>

              <button
                onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })}
                className="rounded-xl border border-white/10 bg-white/5 px-5 py-4 font-semibold text-white/70 hover:bg-white/10 transition-colors"
              >
                Ver o que eu posso fazer
              </button>
            </div>

            {/* Mini guia */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-sm text-white/50">Treinos</p>
                <p className="mt-1 font-semibold text-white">Acesse seu plano e rotina</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-sm text-white/50">Progresso</p>
                <p className="mt-1 font-semibold text-white">Fotos e evolução</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-sm text-white/50">Arquivos</p>
                <p className="mt-1 font-semibold text-white">Envie exames e docs</p>
              </div>
            </div>

            <div className="mt-10 text-center text-xs text-white/30">
              Motion — treino inteligente, gestão simples.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
