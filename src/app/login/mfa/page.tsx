"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase-browser";

export default function MfaPage() {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      const factor = data?.totp?.find((f) => f.status === "verified");
      if (!factor) {
        router.replace("/dashboard");
        return;
      }
      setFactorId(factor.id);
      setReady(true);
    })();
  }, [router]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setLoading(true);
    setError(null);

    try {
      const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chErr || !challenge) throw chErr ?? new Error("Erro ao criar desafio.");

      const { error: verErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (verErr) throw verErr;

      router.push("/dashboard");
    } catch (err: any) {
      const msg = (err?.message || "").toLowerCase();
      setError(
        msg.includes("invalid") || msg.includes("expired")
          ? "Código inválido ou expirado. Verifique o app e tente novamente."
          : "Erro ao verificar. Tente novamente."
      );
      setLoading(false);
    }
  }

  if (!ready) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white/40 text-sm">Carregando…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 shadow-2xl">
        <div className="text-center mb-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-black text-2xl font-extrabold">
            M
          </div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-white">
            Verificação em duas etapas
          </h1>
          <p className="mt-2 text-sm text-white/50">
            Abra o Google Authenticator e insira o código de 6 dígitos.
          </p>
        </div>

        {error && (
          <p className="mb-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-center text-2xl tracking-[0.5em] text-white outline-none focus:border-white/25 transition-colors"
            autoFocus
            required
          />
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-black hover:bg-white/90 disabled:opacity-60 transition"
          >
            {loading ? "Verificando…" : "Confirmar"}
          </button>
        </form>
      </div>
    </main>
  );
}
