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
    return process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "");
  }, []);

  async function linkToProfessorIfNeeded() {
    if (!profSlug) return;

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return;

    const { data, error } = await supabase.rpc("link_aluno_to_professor_slug", {
      prof_slug: profSlug,
    });

    if (error) {
      console.warn("link_aluno_to_professor_slug error:", error.message);
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

  const inputClass =
    "w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-white/25 transition-colors";

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white px-4 py-14 flex items-center justify-center">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03]">
        <div className="border-b border-white/8 bg-black/40 px-6 py-4">
          <p className="text-sm font-semibold">
            {profSlug ? "Treinar com este professor" : "Entrar como aluno"}
          </p>
          <p className="mt-1 text-xs text-white/50">
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
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                mode === "signup"
                  ? "bg-white text-black"
                  : "bg-white/5 text-white/70 hover:bg-white/10"
              }`}
            >
              Criar conta
            </button>
            <button
              onClick={() => setMode("login")}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                mode === "login"
                  ? "bg-white text-black"
                  : "bg-white/5 text-white/70 hover:bg-white/10"
              }`}
            >
              Entrar
            </button>
          </div>

          {msg && (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
              {msg}
            </div>
          )}
          {err && (
            <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
              {err}
            </div>
          )}

          {/* Form */}
          <div className="mt-5 space-y-3">
            {mode === "signup" && (
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className={inputClass}
                placeholder="Seu nome completo"
              />
            )}

            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="Seu e-mail"
              type="email"
              autoComplete="email"
            />

            <input
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className={inputClass}
              placeholder="Sua senha"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />

            <button
              disabled={loading}
              onClick={mode === "login" ? handleLogin : handleSignup}
              className="mt-2 w-full rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-60 transition-colors"
            >
              {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
            </button>

            <div className="mt-3 text-center text-xs text-white/40">
              <Link href="/" className="hover:text-white transition-colors">
                Voltar ao Motion
              </Link>
            </div>
          </div>
        </div>

        <div className="border-t border-white/8 bg-black/40 px-6 py-4 text-center text-xs text-white/40">
          Motion • aluno vinculado ao professor via link
        </div>
      </div>
    </main>
  );
}

export default function AlunoEntrarPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
          <p className="text-white/40 text-sm">Carregando…</p>
        </div>
      }
    >
      <AlunoEntrarInner />
    </Suspense>
  );
}
