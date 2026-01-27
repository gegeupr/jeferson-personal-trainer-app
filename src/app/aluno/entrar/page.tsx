"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/utils/supabase-browser";

function AlunoEntrarInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const profSlug = searchParams.get("prof")?.trim() || "";

  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const siteUrl = useMemo(() => {
    // Se você tiver NEXT_PUBLIC_SITE_URL, use. Senão cai no location.origin
    return process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "");
  }, []);

  async function linkToProfessorIfNeeded() {
    if (!profSlug) return;

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return;

    // chama RPC do supabase para vincular aluno -> professor por slug
    const { data, error } = await supabase.rpc("link_aluno_to_professor_slug", {
      prof_slug: profSlug,
    });

    if (error) {
      // se já estiver vinculado ou role não for aluno, pode dar erro
      console.warn("link_aluno_to_professor_slug error:", error.message);
      // não bloqueia o fluxo
      return;
    }

    console.log("Vínculo ok:", data);
  }

  async function handleLogin() {
    setLoading(true);
    setErr(null);
    setMsg(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }

    await linkToProfessorIfNeeded();

    setMsg("Tudo certo! Redirecionando...");
    router.push("/dashboard");
    setLoading(false);
  }

  async function handleSignup() {
    setLoading(true);
    setErr(null);
    setMsg(null);

    const { error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        data: {
          role: "aluno",
          nome_completo: nome,
        },
        emailRedirectTo: `${siteUrl}/auth/callback`,
      },
    });

    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }

    setMsg("Conta criada! Confirme seu e-mail e volte para continuar.");
    setLoading(false);
  }

  // Se já está logado, vincula e manda pro dashboard
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        await linkToProfessorIfNeeded();
        router.push("/dashboard");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-black text-white px-4 py-14">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-28 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-lime-400/12 blur-3xl" />
        <div className="absolute bottom-[-160px] right-[-160px] h-[520px] w-[520px] rounded-full bg-lime-400/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-md overflow-hidden rounded-3xl border border-white/10 bg-white/5">
        <div className="border-b border-white/10 bg-black/40 px-6 py-4">
          <p className="text-sm font-semibold">
            {profSlug ? "Treinar com este professor" : "Entrar como aluno"}
          </p>
          <p className="mt-1 text-xs text-white/60">
            {profSlug
              ? `Você está entrando pelo link do professor: ${profSlug}`
              : "Faça login ou crie sua conta de aluno."}
          </p>
        </div>

        <div className="px-6 py-7">
          {/* Tabs */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode("signup")}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                mode === "signup"
                  ? "bg-lime-400 text-black"
                  : "bg-white/5 text-white/80 hover:bg-white/10"
              }`}
            >
              Criar conta
            </button>
            <button
              onClick={() => setMode("login")}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                mode === "login"
                  ? "bg-lime-400 text-black"
                  : "bg-white/5 text-white/80 hover:bg-white/10"
              }`}
            >
              Entrar
            </button>
          </div>

          {msg && (
            <div className="mt-4 rounded-2xl border border-lime-400/20 bg-lime-400/10 px-4 py-3 text-sm text-lime-200">
              {msg}
            </div>
          )}
          {err && (
            <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {err}
            </div>
          )}

          {/* Form */}
          <div className="mt-5 space-y-3">
            {mode === "signup" && (
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-lime-400/40"
                placeholder="Seu nome completo"
              />
            )}

            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-lime-400/40"
              placeholder="Seu e-mail"
              type="email"
              autoComplete="email"
            />

            <input
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-lime-400/40"
              placeholder="Sua senha"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />

            <button
              disabled={loading}
              onClick={mode === "login" ? handleLogin : handleSignup}
              className="mt-2 w-full rounded-full bg-lime-400 px-6 py-3 text-sm font-semibold text-black hover:bg-lime-300 disabled:opacity-60"
            >
              {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
            </button>

            <div className="mt-3 text-center text-xs text-white/55">
              <Link href="/" className="hover:text-white">
                Voltar ao Motion
              </Link>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 bg-black/40 px-6 py-4 text-center text-xs text-white/50">
          Motion • aluno vinculado ao professor via link
        </div>
      </div>
    </main>
  );
}

export default function AlunoEntrarPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Carregando…</div>}>
      <AlunoEntrarInner />
    </Suspense>
  );
}
