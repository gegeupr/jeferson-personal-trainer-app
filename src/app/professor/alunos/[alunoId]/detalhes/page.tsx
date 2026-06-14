"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/utils/supabase-browser";

type AlunoProfile = {
  id: string;
  nome_completo: string | null;
  email: string | null;
  telefone: string | null;

  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  instagram: string | null;

  role: string | null;
  professor_id: string | null;
  ativo: boolean | null;
};

type Assinatura = {
  status: string | null;
  end_at?: string | null;
};

function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}

function buildWhatsAppLink(rawPhone: string | null, msg: string) {
  const digits = onlyDigits(rawPhone || "");
  if (!digits) return null;
  const phone = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

function badgeClass(kind: "ok" | "warn" | "bad" | "neutral") {
  switch (kind) {
    case "ok":
      return "bg-white/10 text-white/80 border border-white/15";
    case "warn":
      return "bg-amber-400/10 text-amber-300 border border-amber-400/20";
    case "bad":
      return "bg-red-400/10 text-red-300 border border-red-400/20";
    default:
      return "bg-white/5 text-white/50 border border-white/10";
  }
}

function assinaturaKind(status?: string | null) {
  const s = (status || "").toLowerCase();
  if (!s) return { label: "Sem assinatura", kind: "neutral" as const };
  if (s === "active" || s === "ativo") return { label: "Em dia", kind: "ok" as const };
  if (s === "pending" || s === "pendente") return { label: "Pendente", kind: "warn" as const };
  if (s === "vencido" || s === "overdue") return { label: "Vencido", kind: "warn" as const };
  if (s === "canceled" || s === "cancelled" || s === "inativo") return { label: "Cancelado", kind: "bad" as const };
  return { label: status || "Status", kind: "neutral" as const };
}

export default function ProfessorAlunoDetalhesPremiumPage() {
  const router = useRouter();
  const params = useParams();
  const alunoId = (params as any)?.alunoId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profId, setProfId] = useState<string | null>(null);
  const [aluno, setAluno] = useState<AlunoProfile | null>(null);
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null);

  const [confirmState, setConfirmState] = useState<{ msg: string; onOk: () => void } | null>(null);
  function showConfirm(msg: string, onOk: () => void) { setConfirmState({ msg, onOk }); }

  const alunoNome = useMemo(() => aluno?.nome_completo || "Aluno", [aluno?.nome_completo]);
  const initials = useMemo(() => (alunoNome.slice(0, 1) || "M").toUpperCase(), [alunoNome]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setError(null);

      const { data: auth, error: authError } = await supabase.auth.getUser();
      const user = auth?.user;

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      // Confere role real no profiles (não use app_metadata)
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", user.id)
        .single();

      if (profErr || !prof) {
        router.replace("/login");
        return;
      }

      if ((prof.role || "").toLowerCase() !== "professor") {
        router.replace("/dashboard");
        return;
      }

      setProfId(prof.id);

      // Busca aluno (inclui campos de perfil)
      const { data: alunoData, error: alunoErr } = await supabase
        .from("profiles")
        .select("id, nome_completo, email, telefone, avatar_url, cover_url, bio, instagram, role, professor_id, ativo")
        .eq("id", alunoId)
        .single();

      if (alunoErr || !alunoData) {
        setError("Aluno não encontrado.");
        setLoading(false);
        return;
      }

      // Segurança: esse aluno pertence ao professor logado?
      if ((alunoData.professor_id || "") !== prof.id) {
        setError("Acesso negado. Este aluno não pertence a você.");
        setLoading(false);
        return;
      }

      if ((alunoData.role || "").toLowerCase() !== "aluno") {
        setError("Este usuário não é um aluno.");
        setLoading(false);
        return;
      }

      if (!mounted) return;
      setAluno(alunoData as any);

      // Assinatura (tenta buscar, mas não quebra se não existir)
      const { data: asData } = await supabase
        .from("aluno_assinaturas")
        .select("status, end_at")
        .eq("aluno_id", alunoId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (mounted) setAssinatura((asData as any) || null);

      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [router, alunoId]);

  function handleInativarAluno() {
    if (!aluno) return;
    showConfirm(`Inativar o aluno ${aluno.nome_completo || ""}?`, async () => {
      try {
        setSaving(true);
        setError(null);
        const { error: upErr } = await supabase.from("profiles").update({ ativo: false }).eq("id", aluno.id);
        if (upErr) throw upErr;
        setAluno({ ...aluno, ativo: false });
      } catch (e: any) {
        setError(e?.message || "Erro ao inativar aluno.");
      } finally {
        setSaving(false);
      }
    });
  }

  async function handleAtivarAluno() {
    if (!aluno) return;

    try {
      setSaving(true);
      setError(null);

      const { error: upErr } = await supabase.from("profiles").update({ ativo: true }).eq("id", aluno.id);
      if (upErr) throw upErr;

      setAluno({ ...aluno, ativo: true });
    } catch (e: any) {
      setError(e?.message || "Erro ao ativar aluno.");
    } finally {
      setSaving(false);
    }
  }

  // ⚠️ Excluir de verdade envolve Auth + dados relacionados. Aqui deixo como “soft delete” opcional.
  function handleExcluirAlunoSoft() {
    if (!aluno) return;
    showConfirm(`Remover (desvincular) o aluno ${aluno.nome_completo || ""}?`, async () => {
      try {
        setSaving(true);
        setError(null);
        const { error: upErr } = await supabase.from("profiles").update({ professor_id: null }).eq("id", aluno.id);
        if (upErr) throw upErr;
        router.replace("/professor/alunos");
      } catch (e: any) {
        setError(e?.message || "Erro ao remover aluno.");
      } finally {
        setSaving(false);
      }
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-white/40 text-sm">Carregando…</p>
      </div>
    );
  }

  if (error || !aluno) {
    return (
      <div className="p-6 max-w-lg mx-auto mt-10">
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
          <p className="text-red-300 text-sm font-medium">Erro</p>
          <p className="mt-1 text-white/60 text-sm">{error || "Erro desconhecido"}</p>
          <Link href="/professor/alunos" className="mt-4 inline-block rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 hover:bg-white/10 transition-colors">
            ← Alunos
          </Link>
        </div>
      </div>
    );
  }

  const badge = assinaturaKind(assinatura?.status);
  const isAtivo = aluno.ativo === null || aluno.ativo === undefined ? true : !!aluno.ativo;

  const wa = buildWhatsAppLink(
    aluno.telefone,
    `Olá ${aluno.nome_completo || ""}! Aqui é o seu professor no Motion. Como foi seu treino hoje?`
  );

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 space-y-5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-white/40">
          <Link href="/professor/alunos" className="hover:text-white/70 transition-colors">Alunos</Link>
          <span>/</span>
          <span className="text-white/60">{alunoNome}</span>
        </div>

        {/* HERO */}
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] overflow-hidden">
          <div className="relative h-44 w-full">
            {aluno.cover_url ? (
              <Image src={aluno.cover_url} alt="Capa do aluno" fill className="object-cover opacity-80" priority />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent" />
            )}
            <div className="absolute inset-0 bg-black/50" />
          </div>

          <div className="px-6 pb-6 -mt-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div className="flex items-end gap-4">
              <div className="relative h-16 w-16 rounded-xl overflow-hidden border border-white/10 bg-[#0a0a0a] shrink-0">
                {aluno.avatar_url ? (
                  <Image src={aluno.avatar_url} alt="Avatar" fill className="object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-white font-bold text-xl">
                    {initials}
                  </div>
                )}
              </div>
              <div>
                <p className="text-white/50 text-xs">Aluno</p>
                <p className="text-xl font-semibold text-white mt-0.5">{alunoNome}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className={`text-xs px-2.5 py-1 rounded-full ${badgeClass(badge.kind)}`}>{badge.label}</span>
                  <span className={`text-xs px-2.5 py-1 rounded-full ${badgeClass(isAtivo ? "ok" : "bad")}`}>
                    {isAtivo ? "Ativo" : "Inativo"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {wa ? (
                <a href={wa} target="_blank" rel="noreferrer"
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/10 transition-colors">
                  WhatsApp
                </a>
              ) : null}

              {isAtivo ? (
                <button disabled={saving} onClick={handleInativarAluno}
                  className="rounded-xl border border-amber-400/15 bg-amber-400/8 px-4 py-2 text-sm font-medium text-amber-300 hover:bg-amber-400/12 disabled:opacity-50 transition-colors">
                  Inativar
                </button>
              ) : (
                <button disabled={saving} onClick={handleAtivarAluno}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-50 transition-colors">
                  Ativar
                </button>
              )}

              <button disabled={saving} onClick={handleExcluirAlunoSoft}
                className="rounded-xl border border-red-400/15 bg-red-400/8 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-400/12 disabled:opacity-50 transition-colors">
                Remover
              </button>
            </div>
          </div>

          {/* Info contato */}
          <div className="px-6 pb-5 border-t border-white/8 pt-4 text-sm text-white/50 flex flex-wrap gap-x-6 gap-y-1">
            {aluno.email && <span>{aluno.email}</span>}
            {aluno.telefone && <span>{aluno.telefone}</span>}
            {aluno.instagram && <span>@{aluno.instagram}</span>}
            {aluno.bio && <p className="w-full text-white/40 italic mt-1">{aluno.bio}</p>}
          </div>
        </div>

        {/* AÇÕES */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {/* Card de IA em destaque */}
          <Link
            href={`/professor/alunos/${alunoId}/gerar-treino`}
            className="col-span-2 sm:col-span-3 rounded-2xl border border-white/15 bg-white/[0.06] p-4 hover:bg-white/[0.09] transition-colors"
          >
            <p className="font-semibold text-white text-sm">✦ Gerar treino com IA</p>
            <p className="mt-0.5 text-xs text-white/50">Gemini lê anamnese, fotos e histórico e monta um treino personalizado</p>
          </Link>

          {[
            { href: `anamnese`, label: "Anamnese", desc: "Saúde e histórico" },
            { href: `arquivos`, label: "Arquivos", desc: "Exames e documentos" },
            { href: `atribuir-treino`, label: "Atribuir treino", desc: "Montar e enviar plano" },
            { href: `progresso-aluno`, label: "Progresso", desc: "Evolução e registros" },
            { href: `treinos-extras`, label: "Treinos extras", desc: "Complementos" },
            { href: `financeiro`, label: "Financeiro", desc: "Assinatura e datas" },
          ].map(({ href, label, desc }) => (
            <Link key={href}
              href={`/professor/alunos/${alunoId}/${href}`}
              className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 hover:bg-white/[0.06] transition-colors">
              <p className="font-medium text-white text-sm">{label}</p>
              <p className="mt-0.5 text-xs text-white/40">{desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {confirmState && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-6 max-w-sm w-full">
            <p className="text-white text-sm">{confirmState.msg}</p>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setConfirmState(null)} className="border border-white/10 bg-white/5 px-4 py-2 rounded-xl text-sm text-white/70 hover:bg-white/10 transition-colors">Cancelar</button>
              <button onClick={() => { confirmState.onOk(); setConfirmState(null); }} className="bg-white text-black px-4 py-2 rounded-xl text-sm font-semibold hover:bg-white/90 transition-colors">Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}