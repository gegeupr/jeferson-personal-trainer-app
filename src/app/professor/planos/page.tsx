"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase-browser";

type PlanKey = "30" | "90" | "180";

type Plan = {
  title: string;
  // UI mostra "R$ 100,00", mas no banco guardamos cents (10000)
  price_text: string;
  price_cents: number;
  description: string;
  payment_url: string;
  is_active: boolean;
};

function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}

function safeUrl(v: string) {
  const s = (v || "").trim();
  if (!s) return "";
  return s; // aceita qualquer coisa (link, pix copia/cola etc)
}

function parseBRLToCents(input: string) {
  // aceita "R$100,00", "100,00", "100.00", "100"
  const s = (input || "").toString().trim();
  if (!s) return 0;

  // mantém dígitos, vírgula e ponto
  const cleaned = s.replace(/[^\d.,-]/g, "").replace(/\s/g, "");
  if (!cleaned) return 0;

  // estratégia: se tiver vírgula, assume vírgula como decimal final
  // remove pontos como separador de milhar
  let normalized = cleaned;

  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");

  if (hasComma && hasDot) {
    // "1.234,56" -> "1234.56"
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (hasComma && !hasDot) {
    // "1234,56" -> "1234.56"
    normalized = normalized.replace(",", ".");
  } else {
    // "1234.56" ou "1234" ok
  }

  const num = Number(normalized);
  if (Number.isNaN(num) || !Number.isFinite(num)) return 0;
  return Math.max(0, Math.round(num * 100));
}

function centsToBRL(cents: number) {
  const v = (cents || 0) / 100;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function defaultPlans(): Record<PlanKey, Plan> {
  return {
    "30": {
      title: "Plano Mensal (30 dias)",
      price_text: "R$ 0,00",
      price_cents: 0,
      description: "Acesso completo por 30 dias.",
      payment_url: "",
      is_active: true,
    },
    "90": {
      title: "Plano Trimestral (90 dias)",
      price_text: "R$ 0,00",
      price_cents: 0,
      description: "Acesso completo por 90 dias.",
      payment_url: "",
      is_active: true,
    },
    "180": {
      title: "Plano Semestral (180 dias)",
      price_text: "R$ 0,00",
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

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setErrMsg(null);
      setOkMsg(null);

      const { data: auth, error: authError } = await supabase.auth.getUser();
      const user = auth?.user;
      if (authError || !user) {
        router.replace("/login");
        return;
      }

      // perfil do professor
      const { data: prof, error: pErr } = await supabase
        .from("profiles")
        .select("id, role, telefone, pagamento")
        .eq("id", user.id)
        .single();

      if (!mounted) return;

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

      // whatsapp: tenta primeiro profiles.pagamento.whatsapp, senão usa telefone
      const existingPay = (prof.pagamento || null) as any;
      const wa = existingPay?.whatsapp ?? onlyDigits(prof.telefone || "") ?? "";
      setWhatsapp(wa);

      // 🔥 carrega planos da TABELA professor_planos
      const { data: planosDB, error: plErr } = await supabase
        .from("professor_planos")
        .select("duration_days, title, description, price_cents, payment_url, is_active, whatsapp")
        .eq("professor_id", prof.id)
        .order("duration_days", { ascending: true });

      if (!mounted) return;

      // se RLS bloquear, aqui vai aparecer o erro
      if (plErr) {
        console.warn("Erro carregando professor_planos:", plErr.message);
        // ainda deixa o usuário editar defaults e salvar
        setPlans((prev) => prev);
        setLoading(false);
        return;
      }

      const base = defaultPlans();
      const merged = { ...base };

      if (Array.isArray(planosDB) && planosDB.length > 0) {
        for (const row of planosDB as any[]) {
          const k = String(row.duration_days) as PlanKey;
          if (k !== "30" && k !== "90" && k !== "180") continue;

          merged[k] = {
            title: row.title ?? base[k].title,
            description: row.description ?? base[k].description,
            price_cents: Number(row.price_cents || 0),
            price_text: centsToBRL(Number(row.price_cents || 0)),
            payment_url: row.payment_url ?? "",
            is_active: row.is_active ?? true,
          };
          // se whatsapp vier na linha, prioriza
          if (row.whatsapp) setWhatsapp(String(row.whatsapp));
        }
      }

      setPlans(merged);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  async function save() {
    if (!profId) return;

    setSaving(true);
    setOkMsg(null);
    setErrMsg(null);

    try {
      const wa = onlyDigits(whatsapp);

      // 1) upsert dos 3 planos na tabela professor_planos
      const rows = (["30", "90", "180"] as PlanKey[]).map((k) => {
        const p = plans[k];
        const cents = p.price_cents ?? parseBRLToCents(p.price_text);

        return {
          professor_id: profId,
          duration_days: Number(k), // 30/90/180
          title: (p.title || "").trim(),
          description: (p.description || "").trim(),
          price_cents: cents,
          payment_url: safeUrl(p.payment_url),
          is_active: !!p.is_active,
          whatsapp: wa,
        };
      });

      // ⚠️ precisa ter UNIQUE(professor_id, duration_days) no banco
      // se não tiver, vai inserir duplicado. Recomendo criar esse unique.
      const { error: upErr } = await supabase
        .from("professor_planos")
        .upsert(rows, { onConflict: "professor_id,duration_days" });

      if (upErr) throw upErr;

      // 2) salva whatsapp também em profiles.pagamento (pra manter compatibilidade)
      const { error: profErr } = await supabase
        .from("profiles")
        .update({ pagamento: { whatsapp: wa } })
        .eq("id", profId);

      if (profErr) throw profErr;

      setOkMsg("Planos salvos com sucesso (tabela professor_planos).");
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
            Você define preços e links. O aluno paga e te envia comprovante no WhatsApp.
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

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
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
                      <label className="text-xs text-white/50">Valor</label>
                      <input
                        value={p.price_text}
                        onChange={(e) => {
                          const txt = e.target.value;
                          updatePlan(k, { price_text: txt, price_cents: parseBRLToCents(txt) });
                        }}
                        className="mt-2 w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-lime-400/40 focus:ring-2 focus:ring-lime-400/10 transition"
                        placeholder="Ex: R$ 149,90"
                      />
                      <p className="mt-1 text-xs text-white/40">
                        Salvo no banco como centavos: <b>{p.price_cents}</b>
                      </p>
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
                        Pode ser Mercado Pago, Stripe, PagSeguro, Pix, o que você quiser.
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
              Esses planos devem aparecer para seus alunos na tela de planos do professor.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}