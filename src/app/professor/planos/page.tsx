"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase-browser";

type PlanKey = "30" | "90" | "180";

type Plan = {
  title: string;
  price: string;        // texto no input (ex: "R$ 100,00")
  price_cents: number;  // salvo no banco
  description: string;
  payment_url: string;
  is_active: boolean;
};

type DbPlanRow = {
  id: string;
  professor_id: string;
  duration_days: number;
  title: string | null;
  description: string | null;
  price_cents: number | null;
  payment_url: string | null;
  whatsapp: string | null;
  is_active: boolean | null;
};

function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}

function moneyToCentsBR(v: string) {
  // aceita "100", "100,00", "R$ 100,00"
  const s = (v || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const num = Number(s);
  if (Number.isNaN(num)) return 0;
  return Math.round(num * 100);
}

function centsToMoneyBR(cents: number) {
  const v = (cents || 0) / 100;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function defaultPlans(): Record<PlanKey, Plan> {
  return {
    "30": {
      title: "Plano Mensal (30 dias)",
      price: "R$ 0,00",
      price_cents: 0,
      description: "Acesso completo por 30 dias.",
      payment_url: "",
      is_active: true,
    },
    "90": {
      title: "Plano Trimestral (90 dias)",
      price: "R$ 0,00",
      price_cents: 0,
      description: "Acesso completo por 90 dias.",
      payment_url: "",
      is_active: true,
    },
    "180": {
      title: "Plano Semestral (180 dias)",
      price: "R$ 0,00",
      price_cents: 0,
      description: "Acesso completo por 180 dias.",
      payment_url: "",
      is_active: true,
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
  const [whatsapp, setWhatsapp] = useState("");
  const [plans, setPlans] = useState<Record<PlanKey, Plan>>(defaultPlans());

  const waDigits = useMemo(() => onlyDigits(whatsapp), [whatsapp]);
  const waFinal = useMemo(
    () => (waDigits.startsWith("55") ? waDigits : waDigits ? `55${waDigits}` : ""),
    [waDigits]
  );

  function updatePlan(k: PlanKey, patch: Partial<Plan>) {
    setPlans((prev) => ({
      ...prev,
      [k]: { ...prev[k], ...patch },
    }));
  }

  async function load() {
    setLoading(true);
    setErrMsg(null);
    setOkMsg(null);

    const { data: auth, error: authError } = await supabase.auth.getUser();
    const user = auth?.user;

    if (authError || !user) {
      router.replace("/login");
      return;
    }

    // perfil do professor (pra pegar role e telefone)
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

    // whatsapp padrão
    setWhatsapp(onlyDigits(prof.telefone || ""));

    // carrega planos do banco
    const { data: rows, error: rErr } = await supabase
      .from("professor_planos")
      .select("id, professor_id, duration_days, title, description, price_cents, payment_url, whatsapp, is_active")
      .eq("professor_id", prof.id);

    if (rErr) {
      // se der erro aqui, quase sempre é RLS bloqueando SELECT
      setErrMsg(`Erro ao carregar planos: ${rErr.message}`);
      setLoading(false);
      return;
    }

    const base = defaultPlans();

    // aplica o que existe no banco por duration_days
    const merged = { ...base };
    (rows || []).forEach((r: DbPlanRow) => {
      const key = String(r.duration_days) as PlanKey;
      if (!merged[key]) return;

      merged[key] = {
        title: r.title ?? merged[key].title,
        description: r.description ?? merged[key].description,
        price_cents: r.price_cents ?? merged[key].price_cents,
        price: centsToMoneyBR(r.price_cents ?? 0),
        payment_url: r.payment_url ?? merged[key].payment_url,
        is_active: r.is_active ?? true,
      };

      if (r.whatsapp) setWhatsapp(onlyDigits(r.whatsapp));
    });

    setPlans(merged);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!profId) return;

    setSaving(true);
    setOkMsg(null);
    setErrMsg(null);

    try {
      const wa = onlyDigits(whatsapp);

      // monta 3 linhas para UPSERT
      const payload = (["30", "90", "180"] as PlanKey[]).map((k) => {
        const p = plans[k];
        const cents = p.price_cents || moneyToCentsBR(p.price);

        return {
          professor_id: profId,
          duration_days: Number(k),
          title: (p.title || "").trim(),
          description: (p.description || "").trim(),
          price_cents: cents,
          payment_url: (p.payment_url || "").trim(),
          whatsapp: wa,
          is_active: !!p.is_active,
        };
      });

      // IMPORTANTE: para upsert funcionar bem, tenha UNIQUE(professor_id, duration_days)
      const { error } = await supabase
        .from("professor_planos")
        .upsert(payload, { onConflict: "professor_id,duration_days" });

      if (error) throw error;

      setOkMsg("Planos salvos com sucesso na tabela professor_planos.");
      await load();
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
          <div className="text-sm text-white/60">Meus Planos (tabela professor_planos)</div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 pb-16">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-2xl font-extrabold">
            Planos do <span className="text-lime-300">Professor</span>
          </h1>
          <p className="mt-2 text-white/60 text-sm">
            Aqui salva direto na tabela <b>professor_planos</b>.
          </p>

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

          <div className="mt-6">
            <label className="text-sm text-white/60">WhatsApp para comprovante</label>
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
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

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {(["30", "90", "180"] as PlanKey[]).map((k) => {
              const p = plans[k];
              const label = k === "30" ? "30 dias" : k === "90" ? "90 dias" : "180 dias";

              return (
                <div key={k} className="rounded-3xl border border-white/10 bg-black/20 p-5">
                  <div className="flex items-center justify-between">
                    <p className="font-extrabold text-white">{label}</p>

                    <label className="text-xs text-white/60 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!p.is_active}
                        onChange={(e) => updatePlan(k, { is_active: e.target.checked })}
                      />
                      Ativo
                    </label>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="text-xs text-white/50">Título do plano</label>
                      <input
                        value={p.title}
                        onChange={(e) => updatePlan(k, { title: e.target.value })}
                        className="mt-2 w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-lime-400/40 focus:ring-2 focus:ring-lime-400/10 transition"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-white/50">Valor (ex: R$ 149,90)</label>
                      <input
                        value={p.price}
                        onChange={(e) => updatePlan(k, { price: e.target.value, price_cents: 0 })}
                        className="mt-2 w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-lime-400/40 focus:ring-2 focus:ring-lime-400/10 transition"
                      />
                      <p className="mt-2 text-xs text-white/40">
                        (Salva em <b>price_cents</b> automaticamente)
                      </p>
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
              Esses planos devem aparecer para seus alunos no link público / página de planos.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}