"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase-browser";

type SubStatus = "trial" | "active" | "past_due" | "canceled" | null;

export default function ProfessorPricingPage() {
  const [status, setStatus] = useState<SubStatus>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) { setLoadingStatus(false); return; }

      const { data } = await supabase
        .from("professor_assinaturas")
        .select("status")
        .eq("professor_id", user.id)
        .maybeSingle();

      setStatus((data?.status as SubStatus) ?? null);
      setLoadingStatus(false);
    })();
  }, []);

  async function abrirPortal() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/customer-portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao abrir portal.");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido.");
      setLoading(false);
    }
  }

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

  const isPastDue = status === "past_due";

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full rounded-2xl border border-white/8 bg-white/[0.03] p-8 text-center">

        {isPastDue ? (
          <>
            <div className="mb-6">
              <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium px-4 py-2 rounded-full mb-4">
                <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                Pagamento não processado
              </div>
              <h1 className="text-2xl font-bold mb-2">Sua conta está suspensa</h1>
              <p className="text-white/60 text-sm leading-relaxed">
                Não conseguimos cobrar sua assinatura. Atualize seu método de pagamento para reativar o acesso imediatamente.
              </p>
            </div>

            <div className="bg-white/[0.03] border border-white/8 rounded-xl p-4 mb-6 text-left text-sm text-white/60 space-y-1">
              <p>Possíveis causas:</p>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li>Saldo insuficiente no cartão</li>
                <li>Cartão expirado ou cancelado</li>
                <li>Bloqueio do banco para compras online</li>
              </ul>
            </div>
          </>
        ) : (
          <>
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
          </>
        )}

        {error && (
          <p className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 mb-4 text-sm text-red-300">
            {error}
          </p>
        )}

        {!loadingStatus && (
          isPastDue ? (
            <button
              onClick={abrirPortal}
              disabled={loading}
              className="w-full bg-white hover:bg-white/90 disabled:opacity-60 text-black font-bold py-3 rounded-xl transition"
            >
              {loading ? "Redirecionando…" : "Atualizar método de pagamento"}
            </button>
          ) : (
            <button
              onClick={assinar}
              disabled={loading}
              className="w-full bg-white hover:bg-white/90 disabled:opacity-60 text-black font-bold py-3 rounded-xl transition"
            >
              {loading ? "Redirecionando…" : "Assinar agora"}
            </button>
          )
        )}

        <p className="text-white/40 text-xs mt-4">
          Pagamento seguro via Stripe. Cancele quando quiser.
        </p>
      </div>
    </main>
  );
}
