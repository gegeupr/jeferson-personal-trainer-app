// src/app/dashboard/page.tsx
"use client";

const WELCOME_PENDING_KEY = "motion_welcome_pending";
const WELCOME_SEEN_KEY = "motion_welcome_seen";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase-browser";

const PROF_STORAGE_KEY = "motion_prof_slug";

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function tryLinkAlunoToProfessorIfNeeded() {
    // Se tiver um prof slug salvo (vindo do /login?prof=slug), tenta vincular
    const profSlug = (localStorage.getItem(PROF_STORAGE_KEY) || "").trim().toLowerCase();
    if (!profSlug) return;

    const { data, error } = await supabase.rpc("link_aluno_to_professor_slug", {
      prof_slug: profSlug,
    });

    // Se vinculou ou já estava vinculado, limpa a chave
    if (!error && data?.ok) {
      localStorage.removeItem(PROF_STORAGE_KEY);
    }
    // Se falhar, não impede o fluxo — apenas não vincula
  }

  useEffect(() => {
    async function getUserAndProfile() {
      setLoading(true);
      setError(null);

      // 1) Usuário autenticado?
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        console.error("Usuário não autenticado:", authError?.message);
        router.push("/login");
        return;
      }

      // 2) Puxa role + professor_id (pra sabermos se é aluno e se já está vinculado)
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("role, professor_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profileData?.role) {
        console.error("Erro ao buscar perfil ou role não definida:", profileError?.message);
        setError("Erro ao carregar seu perfil. Tente fazer login novamente.");
        await supabase.auth.signOut();
        router.push("/login");
        return;
      }

      const userRole = profileData.role;

      // ✅ 3) Backup do “Treinar comigo”
      // Se for ALUNO e ainda não tiver professor, tenta vincular via localStorage
      if (userRole === "aluno" && !profileData.professor_id) {
        await tryLinkAlunoToProfessorIfNeeded();
      }

      // 4) Recarrega o profile para pegar o estado mais atual (caso tenha vinculado agora)
      const { data: profileData2, error: profileError2 } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError2 || !profileData2?.role) {
        console.error("Erro ao buscar perfil após vínculo:", profileError2?.message);
        setError("Erro ao atualizar seu perfil. Tente novamente.");
        return;
      }

      const finalRole = profileData2.role;

      // 5) Redireciona
      if (finalRole === "professor") {
        router.push("/professor/dashboard");
      } else if (finalRole === "aluno") {
        router.push("/aluno/dashboard");
      } else {
        console.warn("Role do usuário desconhecida:", finalRole);
        setError("Sua permissão de acesso não foi reconhecida.");
        await supabase.auth.signOut();
        router.push("/login");
      }
    }

    getUserAndProfile();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        router.push("/login");
      } else if (event === "SIGNED_IN" && session?.user) {
        getUserAndProfile();
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center text-lime-400 text-2xl">
        Redirecionando para o dashboard...
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-red-500 text-lg p-4">
        <p>{error}</p>
      </main>
    );
  }

  return null;
}
