"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase-browser";

type PlanKey = "30" | "90" | "180";

type Plan = {
  name: string;
  price: string;
  description: string;
  payment_url: string;
};

type PaymentConfig = {
  whatsapp: string; // só números (ex: 42988311053) ou com 55...
  plans: Record<PlanKey, Plan>;
};

function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}

function safeUrl(v: string) {
  const s = (v || "").trim();
  if (!s) return "";
  // aceita link normal http/https ou links do tipo "pix", "mpago", etc? -> aqui vamos exigir http(s) p/ evitar bagunça
  // se você quiser aceitar qualquer coisa, remova esta validação.
  if (!/^https?:\/\//i.test(s)) return s; // não bloqueia; só não força http
  return s;
}

function defaultConfig(): PaymentConfig {
  return {
    whatsapp: "",
    plans: {
      "30": {
        name: "Plano Mensal (30 dias)",
        price: "R$ 0,00",
        description: "Acesso completo por 30 dias.",
        payment_url: "",
      },
      "90": {
        name: "Plano Trimestral (90 dias)",
        price: "R$ 0,00",
        description: "Acesso completo por 90 dias.",
        payment_url: "",
      },
      "180": {
        name: "Plano Semestral (180 dias)",
        price: "R$ 0,00",
        description: "Acesso completo por 180 dias.",
        payment_url: "",
      },
    },
  };
}

export default function ProfessorPlanosPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const [profId, setProfId] = useState<string | null>(null);
  const [config, setConfig] = useState<PaymentConfig>(defaultConfig());

  const waDigits = useMemo(() => onlyDigits(config.whatsapp), [config.whatsapp]);
  const waFinal = useMemo(() => (waDigits.startsWith("55") ? waDigits : waDigits ? `55${waDigits}` : ""), [waDigits]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErrMsg(null);

      const { data: auth, error: authError } = await supabase.auth.getUser();
      const user = auth?.user;
      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const { data: prof, error: pErr } = await supabase
        .from("profiles")
        .select("id, role, telefone, pagamento")
        .eq("id", user.id)
        .single();

      if (pErr || !prof) {
        setErrMsg("Não foi possível carregar seu perfil.");
        setLoading(false);
        return;
      }

      if ((prof.role || "").toLowerCase() !== "professor") {
        router.replace("/dashboard");
        return;
      }

      setProfId(prof.id);

      // carrega config existente (profiles.pagamento)
      const existing = (prof.pagamento || null) as any;

      const base = defaultConfig();
      const merged: PaymentConfig = {
        whatsapp: existing?.whatsapp ?? onlyDigits(prof.telefone || "") ?? "",
        plans: {
          "30": { ...base.plans["30"], ...(existing?.plans?.["30"] || {}) },
          "90": { ...base.plans["90"], ...(existing?.plans?.["90"] || {}) },
          "180": { ...base.plans["180"], ...(existing?.plans?.["180"] || {}) },
        },
      };

      setConfig(merged);
      setLoading(false);
    })();
  }, [router]);

  function updatePlan(k: PlanKey, patch: Partial<Plan>) {
    setConfig((prev) => ({
      ...prev,
      plans: {
        ...prev.plans,
        [k]: { ...prev.plans[k], ...patch },
      },
    }));
  }

  async function save() {
    if (!profId) return;

    setSaving(true);
    setOkMsg(null);
    setErrMsg(null);

    try {
      const payload: PaymentConfig = {
        whatsapp: onlyDigits(config.whatsapp),
        plans: {
          "30": {
            ...config.plans["30"],
            payment_url: safeUrl(config.plans["30"].payment_url),
          },
          "90": {
            ...config.plans["90"],
            payment_url: safeUrl(config.plans["90"].payment_url),
          },
          "180": {
            ...config.plans["180"],
            payment_url: safeUrl(config.plans["180"].payment_url),
          },
        },
      };

      const { error } = await supabase.from("profiles").update({ pagamento: payload }).eq("id", profId);
      if (error) throw error;

      setOkMsg("Planos salvos com sucesso.");
    } catch (e: any) {
      setErrMsg(e?.message || "Erro ao salvar planos.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-lime-300 text-lg">Carregando…</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* TOP BAR */}
      <div className="sticky top-0 z-50 border-b border-white/10 bg-black/60 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <Link
            href="/professor/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
          >
            ← Voltar ao Dashboard
          </Link>
          <div className="text-sm text-white/60">Meus Planos (links de pagamento)</div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 pb-16">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-2xl font-extrabold">
            Planos do <span className="text-lime-300">Professor</span>
          </h1>
          <p className="mt-2 text-white/60 text-sm">
            Você define os preços e links. O pagamento cai direto pra você. O aluno paga e te envia o comprovante no WhatsApp.
          </p>

          {errMsg ? (
            <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">{errMsg}</div>
          ) : null}

          {okMsg ? (
            <div className="mt-4 rounded-2xl border border-lime-400/20 bg-lime-400/10 p-4 text-lime-200">{okMsg}</div>
          ) : null}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="text-sm text-white/60">WhatsApp para comprovante</label>
              <input
                value={config.whatsapp}
                onChange={(e) => setConfig((p) => ({ ...p, whatsapp: e.target.value }))}
                className="mt-2 w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-lime-400/40 focus:ring-2 focus:ring-lime-400/10 transition"
                placeholder="Ex: 42988311053"
              />
              <p className="mt-2 text-xs text-white/40">
                Dica: só números. Se você não colocar DDI, o app assume Brasil (55).
              </p>

              {waFinal ? (
                <p className="mt-2 text-xs text-white/50">
                  Preview: <span className="text-lime-300">wa.me/{waFinal}</span>
                </p>
              ) : null}
            </div>

            {(["30", "90", "180"] as PlanKey[]).map((k) => {
              const p = config.plans[k];
              const label = k === "30" ? "30 dias" : k === "90" ? "90 dias" : "180 dias";
              return (
                <div key={k} className="rounded-3xl border border-white/10 bg-black/20 p-5">
                  <div className="flex items-center justify-between">
                    <p className="font-extrabold text-white">{label}</p>
                    <span className="text-xs text-white/40">editável</span>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="text-xs text-white/50">Nome do plano</label>
                      <input
                        value={p.name}
                        onChange={(e) => updatePlan(k, { name: e.target.value })}
                        className="mt-2 w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-lime-400/40 focus:ring-2 focus:ring-lime-400/10 transition"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-white/50">Valor (texto)</label>
                      <input
                        value={p.price}
                        onChange={(e) => updatePlan(k, { price: e.target.value })}
                        className="mt-2 w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-lime-400/40 focus:ring-2 focus:ring-lime-400/10 transition"
                        placeholder="Ex: R$ 149,90"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-white/50">Descrição</label>
                      <textarea
                        value={p.description}
                        onChange={(e) => updatePlan(k, { description: e.target.value })}
                        className="mt-2 w-full min-h-[90px] rounded-2xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-lime-400/40 focus:ring-2 focus:ring-lime-400/10 transition"
                        placeholder="O que está incluso"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-white/50">Link de pagamento</label>
                      <input
                        value={p.payment_url}
                        onChange={(e) => updatePlan(k, { payment_url: e.target.value })}
                        className="mt-2 w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-lime-400/40 focus:ring-2 focus:ring-lime-400/10 transition"
                        placeholder="https://..."
                      />
                      <p className="mt-2 text-xs text-white/40">
                        Pode ser Mercado Pago, Stripe, PagSeguro, PIX Copia/Cola via link, o que você quiser.
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-2xl bg-lime-500 px-6 py-3 text-black font-extrabold hover:bg-lime-400 transition disabled:opacity-60"
            >
              {saving ? "Salvando…" : "Salvar Planos"}
            </button>

            <p className="text-sm text-white/45">
              Esses planos aparecem para seus alunos em <span className="text-white/70">/aluno/planos</span>.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}