"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase-browser";

export default function RedefinirSenhaPage() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function boot() {
      setErr(null);
      setMsg(null);

      // Ao abrir pelo link de recovery, o supabase-js normalmente já “pega” a sessão do hash
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      setHasSession(Boolean(data.session));
      setReady(true);

      // Se quiser: acompanhar mudança de sessão
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        setHasSession(Boolean(session));
      });

      return () => sub.subscription.unsubscribe();
    }

    boot();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    if (senha.length < 6) {
      setErr("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (senha !== confirmar) {
      setErr("As senhas não coincidem.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) throw error;

      setMsg("Senha atualizada com sucesso! Você já pode entrar.");
      // opcional: desloga e manda pro login
      await supabase.auth.signOut();
      setTimeout(() => router.replace("/login"), 900);
    } catch (e: any) {
      setErr(e?.message || "Não foi possível atualizar a senha.");
    } finally {
      setLoading(false);
    }
  }

  if (!ready) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center text-lime-300 text-lg">
        Carregando…
      </main>
    );
  }

  // Se abriu direto (sem link), não tem sessão de recovery
  if (!hasSession) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center p-4 text-white">
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8">
          <h1 className="text-2xl font-extrabold text-lime-300">Link inválido</h1>
          <p className="mt-2 text-sm text-white/70">
            Abra esta página pelo link enviado no seu e-mail de recuperação.
          </p>
          <div className="mt-5 flex gap-2">
            <Link
              href="/recuperar-senha"
              className="rounded-2xl bg-lime-400 px-4 py-2 text-sm font-bold text-black hover:bg-lime-300"
            >
              Enviar novo link
            </Link>
            <Link
              href="/login"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
            >
              Login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur text-white">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-lime-400 text-black text-2xl font-extrabold">
            M
          </div>
          <h1 className="mt-4 text-2xl font-extrabold text-lime-300">Redefinir senha</h1>
          <p className="mt-2 text-sm text-white/70">Escolha uma nova senha para sua conta.</p>
        </div>

        {err ? (
          <p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
            {err}
          </p>
        ) : null}

        {msg ? (
          <p className="mt-4 rounded-xl border border-lime-400/20 bg-lime-400/10 p-3 text-sm text-lime-200">
            {msg}
          </p>
        ) : null}

        <form onSubmit={handleUpdate} className="mt-6 space-y-4">
          <input
            type="password"
            placeholder="Nova senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-lime-400/40"
            required
          />
          <input
            type="password"
            placeholder="Confirmar nova senha"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-lime-400/40"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-lime-400 px-4 py-3 text-sm font-bold text-black hover:bg-lime-300 disabled:opacity-60"
          >
            {loading ? "Salvando..." : "Salvar nova senha"}
          </button>

          <div className="text-center">
            <Link href="/login" className="text-xs text-white/60 hover:text-white/80 hover:underline">
              Voltar para o login
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}