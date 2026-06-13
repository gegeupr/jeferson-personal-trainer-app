"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase-browser";
import Link from "next/link";

type Assinatura = {
  status: string | null;
  start_at: string | null;
  end_at: string | null;
  duration_days: number | null;
};

type ProfPix = {
  nome_completo: string | null;
  chave_pix: string | null;
  tipo_chave_pix: string | null;
  whatsapp: string | null;
};

const TIPO_LABEL: Record<string, string> = {
  cpf: "CPF",
  email: "E-mail",
  telefone: "Telefone",
  aleatoria: "Chave aleatória",
};

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

function daysLeft(end?: string | null) {
  if (!end) return null;
  const ms = new Date(end).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / 86400000));
}

function waLink(phone?: string | null) {
  const d = (phone || "").replace(/\D/g, "");
  if (!d) return null;
  return `https://wa.me/${d.startsWith("55") ? d : "55" + d}`;
}

export default function AssinaturaAlunoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null);
  const [prof, setProf] = useState<ProfPix | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) { router.push("/login"); return; }

      const { data: me } = await supabase.from("profiles").select("role, professor_id").eq("id", user.id).maybeSingle();
      if (me?.role !== "aluno") { router.push("/dashboard"); return; }

      const { data: asData } = await supabase
        .from("aluno_assinaturas")
        .select("status, start_at, end_at, duration_days")
        .eq("aluno_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setAssinatura((asData as Assinatura) ?? null);

      if (me?.professor_id) {
        const { data: p } = await supabase
          .from("profiles").select("nome_completo, chave_pix, tipo_chave_pix, whatsapp").eq("id", me.professor_id).maybeSingle();
        setProf((p as ProfPix) ?? null);
      }

      setLoading(false);
    })();
  }, [router]);

  async function copiar() {
    if (!prof?.chave_pix) return;
    await navigator.clipboard.writeText(prof.chave_pix);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-white/40 text-sm">Carregando…</p>
      </div>
    );
  }

  const ativo = assinatura?.status === "active";
  const restante = daysLeft(assinatura?.end_at);
  const wpp = waLink(prof?.whatsapp);

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white px-4 py-8">
      <div className="max-w-lg mx-auto space-y-5">
        <div className="flex items-center gap-2 text-sm text-white/40">
          <Link href="/aluno/dashboard" className="hover:text-white/70 transition-colors">Dashboard</Link>
          <span>/</span>
          <span className="text-white/60">Minha assinatura</span>
        </div>

        <h1 className="text-2xl font-bold text-white">Minha assinatura</h1>

        {/* Status */}
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          {ativo ? (
            <>
              <p className="font-semibold text-white">Acesso ativo</p>
              <p className="text-white/60 mt-1 text-sm">
                Válido até <span className="text-white">{formatDate(assinatura?.end_at)}</span>
                {restante !== null && <span> — {restante} dia(s) restantes</span>}
              </p>
            </>
          ) : assinatura?.status === "pending" ? (
            <p className="text-amber-300 font-semibold">Pagamento em análise</p>
          ) : (
            <p className="text-red-300 font-semibold">
              {assinatura?.status === "expired" ? "Acesso vencido" : "Sem acesso ativo"}
            </p>
          )}
        </div>

        {/* Pix — só quando não ativo */}
        {!ativo && (
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5 space-y-4">
            <h2 className="font-semibold text-white">Como liberar seu acesso</h2>
            {prof?.chave_pix ? (
              <>
                <ol className="text-white/60 text-sm space-y-1 list-decimal list-inside">
                  <li>Combine o valor com seu professor.</li>
                  <li>Pague via Pix para a chave abaixo.</li>
                  <li>Envie o comprovante para o professor.</li>
                </ol>
                <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                  <p className="text-xs text-white/40 mb-1">
                    Chave Pix
                    {prof.tipo_chave_pix ? ` (${TIPO_LABEL[prof.tipo_chave_pix] ?? prof.tipo_chave_pix})` : ""}
                  </p>
                  <p className="text-white font-mono text-sm break-all">{prof.chave_pix}</p>
                  <button
                    onClick={copiar}
                    className="mt-3 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 transition-colors"
                  >
                    {copied ? "Copiado!" : "Copiar chave"}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-white/50 text-sm">
                Seu professor ainda não cadastrou a chave Pix. Entre em contato com ele.
              </p>
            )}
            {wpp && (
              <a href={wpp} target="_blank" rel="noreferrer"
                className="inline-block text-sm text-white/60 underline hover:text-white transition-colors">
                Falar com {prof?.nome_completo || "o professor"} no WhatsApp
              </a>
            )}
          </div>
        )}

        <Link href="/aluno/dashboard" className="inline-block text-sm text-white/40 hover:text-white/70 transition-colors">
          ← Dashboard
        </Link>
      </div>
    </main>
  );
}
