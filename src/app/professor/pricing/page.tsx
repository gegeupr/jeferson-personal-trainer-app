"use client";

import { useState } from "react";

export default function ProfessorPricingPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function assinar() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/professor-checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao iniciar assinatura.");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full rounded-2xl border border-white/8 bg-white/[0.03] p-8 text-center">
        <h1 className="text-3xl font-bold mb-2">Plano Professor</h1>
        <p className="text-white/60 mb-6">
          Gere treinos com IA, organize seus alunos e cresça sem limite.
        </p>

        <div className="mb-6">
          <span className="text-5xl font-bold">R$ 59,90</span>
          <span className="text-white/50">/mês</span>
        </div>

        <ul className="text-left text-white/70 space-y-2 mb-8 text-sm">
          <li>✓ Geração de treinos com IA (powered by Claude)</li>
          <li>✓ Modelos reutilizáveis por perfil de aluno</li>
          <li>✓ Alunos ilimitados, biblioteca própria</li>
          <li>✓ Controle de acesso e pagamento via Pix</li>
          <li>✓ 7 dias grátis para começar</li>
        </ul>

        {error && (
          <p className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 mb-4 text-sm text-red-300">
            {error}
          </p>
        )}

        <button
          onClick={assinar}
          disabled={loading}
          className="w-full bg-white hover:bg-white/90 disabled:opacity-60 text-black font-bold py-3 rounded-xl transition"
        >
          {loading ? "Redirecionando..." : "Assinar agora"}
        </button>

        <p className="text-white/40 text-xs mt-4">
          Pagamento seguro via Stripe. Cancele quando quiser.
        </p>
      </div>
    </main>
  );
}
