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

function parseBRLToCents(input: string): number {
  const s = (input || "").replace(/[^\d,.-]/g, "").replace(/\./g, "").trim();
  if (!s) return 0;
  const n = Number(s.replace(",", "."));
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

function defaultConfig(): PaymentConfig {
  return {
    whatsapp: "",
    plans: {
      "30":  { title: "Plano Mensal (30 dias)",     price_text: "R$ 100,00", description: "Acesso completo por 30 dias.",  payment_url: "", is_active: true },
      "90":  { title: "Plano Trimestral (90 dias)", price_text: "R$ 300,00", description: "Acesso completo por 90 dias.",  payment_url: "", is_active: true },
      "180": { title: "Plano Semestral (180 dias)", price_text: "R$ 500,00", description: "Acesso completo por 180 dias.", payment_url: "", is_active: true },
    },
  };
}

export default function ProfessorPlanosPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profId, setProfId] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
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
      if (authError || !user) { router.replace("/login"); return; }

      const { data: prof, error: pErr } = await supabase
        .from("profiles").select("id, role, telefone").eq("id", user.id).single();

      if (pErr || !prof) { setErrMsg("Não foi possível carregar seu perfil."); setLoading(false); return; }
      if ((prof.role || "").toLowerCase() !== "professor") { router.replace("/dashboard"); return; }

      setProfId(prof.id);

      const { data: rows, error: rErr } = await supabase
        .from("professor_planos")
        .select("duration_days, title, description, payment_url, price_cents, whatsapp, is_active")
        .eq("professor_id", prof.id);

      if (rErr) { setErrMsg("Erro ao carregar planos."); setLoading(false); return; }

      const base = defaultConfig();
      const whatsapp = (rows && rows[0]?.whatsapp) ? String(rows[0].whatsapp) : onlyDigits(prof.telefone || "");
      const merged: PaymentConfig = { whatsapp, plans: { ...base.plans } };

      if (rows && rows.length > 0) {
        for (const row of rows as any[]) {
          const key = String(row.duration_days) as PlanKey;
          if (key === "30" || key === "90" || key === "180") {
            merged.plans[key] = {
              title: row.title ?? base.plans[key].title,
              description: row.description ?? base.plans[key].description,
              payment_url: row.payment_url ?? base.plans[key].payment_url,
              price_text: typeof row.price_cents === "number"
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
      const { error } = await supabase
        .from("professor_planos")
        .upsert(payloadRows, { onConflict: "professor_id,duration_days" });
      if (error) throw error;
      setOkMsg("Planos salvos!");
    } catch (e: any) {
      setErrMsg(e?.message || "Erro ao salvar planos.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-white/40 text-sm">Carregando…</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white px-4 py-8 pb-16">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-2 text-sm text-white/40">
          <Link href="/professor/dashboard" className="hover:text-white/70 transition-colors">Dashboard</Link>
          <span>/</span>
          <span className="text-white/60">Meus Planos</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-white">Meus Planos</h1>
          <p className="text-white/50 text-sm mt-1">Configure os planos que aparecem para seus alunos.</p>
        </div>

        {errMsg && (
          <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">{errMsg}</div>
        )}
        {okMsg && (
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">{okMsg}</div>
        )}

        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6 space-y-5">
          <div>
            <label className="text-sm text-white/60">WhatsApp para comprovante</label>
            <input
              value={config.whatsapp}
              onChange={(e) => setConfig((p) => ({ ...p, whatsapp: e.target.value }))}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-white/25 transition-colors"
              placeholder="Ex: 42988311053"
            />
            {waFinal ? (
              <p className="mt-1.5 text-xs text-white/40">
                Link: wa.me/<span className="text-white/60">{waFinal}</span>
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {(["30", "90", "180"] as PlanKey[]).map((k) => {
              const p = config.plans[k];
              const label = k === "30" ? "30 dias" : k === "90" ? "90 dias" : "180 dias";

              return (
                <div key={k} className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-white text-sm">{label}</p>
                    <label className="flex items-center gap-1.5 text-xs text-white/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={p.is_active}
                        onChange={(e) => updatePlan(k, { is_active: e.target.checked })}
                        className="accent-white"
                      />
                      ativo
                    </label>
                  </div>

                  <div>
                    <label className="text-xs text-white/40">Nome do plano</label>
                    <input
                      value={p.title}
                      onChange={(e) => updatePlan(k, { title: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none focus:border-white/25 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-white/40">Valor</label>
                    <input
                      value={p.price_text}
                      onChange={(e) => updatePlan(k, { price_text: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none focus:border-white/25 transition-colors"
                      placeholder="Ex: R$ 149,90"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-white/40">Descrição</label>
                    <textarea
                      value={p.description}
                      onChange={(e) => updatePlan(k, { description: e.target.value })}
                      className="mt-1 w-full min-h-[72px] rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none focus:border-white/25 transition-colors resize-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-white/40">Link de pagamento</label>
                    <input
                      value={p.payment_url}
                      onChange={(e) => updatePlan(k, { payment_url: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none focus:border-white/25 transition-colors"
                      placeholder="https://..."
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-60 transition-colors"
            >
              {saving ? "Salvando…" : "Salvar planos"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
