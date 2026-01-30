"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase-browser";

type PlanKey = "30" | "90" | "180";

type Plan = {
  title: string;
  price_text: string;
  description: string;
  payment_url: string;
  is_active: boolean;
};

type PaymentConfig = {
  whatsapp: string;
  plans: Record<PlanKey, Plan>;
};

function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}

// "R$ 100,00" -> 10000
function parseBRLToCents(input: string): number {
  const s = (input || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .trim();

  if (!s) return 0;

  // troca vírgula por ponto
  const n = Number(s.replace(",", "."));
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

function defaultConfig(): PaymentConfig {
  return {
    whatsapp: "",
    plans: {
      "30": {
        title: "Plano Mensal (30 dias)",
        price_text: "R$ 100,00",
        description: "Acesso completo por 30 dias.",
        payment_url: "",
        is_active: true,
      },
      "90": {
        title: "Plano Trimestral (90 dias)",
        price_text: "R$ 300,00",
        description: "Acesso completo por 90 dias.",
        payment_url: "",
        is_active: true,
      },
      "180": {
        title: "Plano Semestral (180 dias)",
        price_text: "R$ 500,00",
        description: "Acesso completo por 180 dias.",
        payment_url: "",
        is_active: true,
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
  const waFinal = useMemo(
    () => (waDigits.startsWith("55") ? waDigits : waDigits ? `55${waDigits}` : ""),
    [waDigits]
  );

  function updatePlan(k: PlanKey, patch: Partial<Plan>) {
    setConfig((prev) => ({
      ...prev,
      plans: { ...prev.plans, [k]: { ...prev.plans[k], ...patch } },
    }));
  }

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

      // valida professor
      const { data: prof, error: pErr } = await supabase
        .from("profiles")
        .select("id, role, telefone")
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

      // carrega planos da tabela professor_planos
      const { data: rows, error: rErr } = await supabase
        .from("professor_planos")
        .select("duration_days, title, description, payment_url, price_cents, whatsapp, is_active")
        .eq("professor_id", prof.id);

      if (rErr) {
        setErrMsg("Erro ao carregar planos (professor_planos).");
        setLoading(false);
        return;
      }

      const base = defaultConfig();

      // whatsapp: pega do primeiro registro, se existir; senão, do telefone do perfil
      const whatsapp =
        (rows && rows[0]?.whatsapp) ? String(rows[0].whatsapp) : onlyDigits(prof.telefone || "");

      const merged: PaymentConfig = {
        whatsapp,
        plans: { ...base.plans },
      };

      if (rows && rows.length > 0) {
        for (const row of rows as any[]) {
          const key = String(row.duration_days) as PlanKey;
          if (key === "30" || key === "90" || key === "180") {
            merged.plans[key] = {
              title: row.title ?? base.plans[key].title,
              description: row.description ?? base.plans[key].description,
              payment_url: row.payment_url ?? base.plans[key].payment_url,
              price_text:
                typeof row.price_cents === "number"
                  ? `R$ ${(row.price_cents / 100).toFixed(2)}`.replace(".", ",")
                  : base.plans[key].price_text,
              is_active: typeof row.is_active === "boolean" ? row.is_active : true,
            };
          }
        }
      }

      setConfig(merged);
      setLoading(false);
    })();
  }, [router]);

  async function save() {
    if (!profId) return;

    setSaving(true);
    setOkMsg(null);
    setErrMsg(null);

    try {
      const whatsapp = onlyDigits(config.whatsapp);

      const payloadRows = (["30", "90", "180"] as PlanKey[]).map((k) => {
        const p = config.plans[k];
        return {
          professor_id: profId,
          duration_days: Number(k),
          title: (p.title || "").trim(),
          description: (p.description || "").trim(),
          payment_url: (p.payment_url || "").trim(),
          price_cents: parseBRLToCents(p.price_text),
          whatsapp,
          is_active: !!p.is_active,
        };
      });

      // ✅ UPSERT: precisa de unique (professor_id, duration_days) no banco
      const { error } = await supabase
        .from("professor_planos")
        .upsert(payloadRows, { onConflict: "professor_id,duration_days" });

      if (error) throw error;

      setOkMsg("Planos salvos na tabela professor_planos ✅");
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
      <div className="sticky top-0 z-50 border-b border-white/10 bg-black/60 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <Link
            href="/professor/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
          >
            ← Voltar ao Dashboard
          </Link>
          <div className="text-sm text-white/60">Meus Planos (professor_planos)</div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 pb-16">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-2xl font-extrabold">
            Planos do <span className="text-lime-300">Professor</span>
          </h1>

          {errMsg ? (
            <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">
              {errMsg}
            </div>
          ) : null}

          {okMsg ? (
            <div className="mt-4 rounded-2xl border border-lime-400/20 bg-lime-400/10 p-4 text-lime-200">
              {okMsg}
            </div>
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
                    <label className="text-xs text-white/60 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={p.is_active}
                        onChange={(e) => updatePlan(k, { is_active: e.target.checked })}
                      />
                      ativo
                    </label>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="text-xs text-white/50">Nome do plano</label>
                      <input
                        value={p.title}
                        onChange={(e) => updatePlan(k, { title: e.target.value })}
                        className="mt-2 w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-lime-400/40 focus:ring-2 focus:ring-lime-400/10 transition"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-white/50">Valor (texto)</label>
                      <input
                        value={p.price_text}
                        onChange={(e) => updatePlan(k, { price_text: e.target.value })}
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
              Agora esses planos realmente ficam em <span className="text-white/70">professor_planos</span>.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}