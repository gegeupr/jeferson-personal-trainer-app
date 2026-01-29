"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/utils/supabase-browser";

function getSiteUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    setMsg(null);

    try {
      const redirectTo = `${getSiteUrl()}/redefinir-senha`;

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });

      if (error) throw error;

      setMsg("Pronto! Enviamos um link de recuperação para seu e-mail.");
    } catch (e: any) {
      setErr(e?.message || "Não foi possível enviar o e-mail de recuperação.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-lime-400 text-black text-2xl font-extrabold">
            M
          </div>
          <h1 className="mt-4 text-2xl font-extrabold text-lime-300">Recuperar senha</h1>
          <p className="mt-2 text-sm text-white/70">
            Digite seu e-mail e enviaremos um link para redefinir sua senha.
          </p>
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

        <form onSubmit={handleSend} className="mt-6 space-y-4">
          <input
            type="email"
            placeholder="Seu e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-lime-400/40"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-lime-400 px-4 py-3 text-sm font-bold text-black hover:bg-lime-300 disabled:opacity-60"
          >
            {loading ? "Enviando..." : "Enviar link"}
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