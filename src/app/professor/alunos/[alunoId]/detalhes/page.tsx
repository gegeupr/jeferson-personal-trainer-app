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
  data_fim?: string | null; // se existir
  next_payment_date?: string | null; // se existir
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
      return "bg-lime-400/15 text-lime-300 border border-lime-400/25";
    case "warn":
      return "bg-yellow-400/15 text-yellow-300 border border-yellow-400/25";
    case "bad":
      return "bg-red-400/15 text-red-300 border border-red-400/25";
    default:
      return "bg-white/5 text-white/70 border border-white/10";
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
        .from("assinaturas")
        .select("status, data_fim, next_payment_date")
        .eq("aluno_id", alunoId)
        .order("data_fim", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (mounted) setAssinatura((asData as any) || null);

      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [router, alunoId]);

  async function handleInativarAluno() {
    if (!aluno) return;
    if (!confirm(`Tem certeza que deseja inativar o aluno ${aluno.nome_completo || ""}?`)) return;

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
  async function handleExcluirAlunoSoft() {
    if (!aluno) return;
    if (!confirm(`Tem certeza que deseja remover (desvincular) o aluno ${aluno.nome_completo || ""}?`)) return;

    try {
      setSaving(true);
      setError(null);

      // Desvincula do professor (mantém dados do aluno)
      const { error: upErr } = await supabase.from("profiles").update({ professor_id: null }).eq("id", aluno.id);
      if (upErr) throw upErr;

      router.replace("/professor/alunos");
    } catch (e: any) {
      setError(e?.message || "Erro ao remover aluno.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center text-lime-300 text-xl">
        Carregando perfil do aluno…
      </main>
    );
  }

  if (error || !aluno) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
        <div className="max-w-xl w-full rounded-3xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-xl font-semibold text-red-200">Erro</h1>
          <p className="mt-2 text-white/70">{error || "Erro desconhecido"}</p>
          <div className="mt-4 flex gap-2">
            <Link
              href="/professor/alunos"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-white/80 hover:bg-white/10 transition"
            >
              ← Voltar para Alunos
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const badge = assinaturaKind(assinatura?.status);
  const isAtivo = aluno.ativo === null || aluno.ativo === undefined ? true : !!aluno.ativo;

  const wa = buildWhatsAppLink(
    aluno.telefone,
    `Olá ${aluno.nome_completo || ""}! Aqui é o seu professor no Motion. Como foi seu treino hoje?`
  );

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* TOP BAR */}
      <div className="sticky top-0 z-50 border-b border-white/10 bg-black/60 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href="/professor/alunos"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
            >
              ← Voltar para Alunos
            </Link>
          </div>

          <div className="text-sm text-white/70">Perfil do aluno</div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* HERO (capa + avatar + status) */}
        <div className="rounded-3xl border border-white/10 bg-white/5 overflow-hidden shadow-2xl">
          <div className="relative h-56 w-full bg-black/40">
            {aluno.cover_url ? (
              <Image src={aluno.cover_url} alt="Capa do aluno" fill className="object-cover opacity-90" priority />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/40 to-black/90" />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/40 to-black/90" />

            <div className="absolute left-6 bottom-[-30px] flex items-end gap-3">
              <div className="relative h-20 w-20 rounded-2xl overflow-hidden border border-white/10 bg-black/40">
                {aluno.avatar_url ? (
                  <Image src={aluno.avatar_url} alt="Avatar do aluno" fill className="object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-lime-300 font-extrabold text-2xl">
                    {initials}
                  </div>
                )}
              </div>

              <div className="pb-2">
                <p className="text-xs text-white/60">Aluno</p>
                <p className="text-lg font-bold">
                  <span className="text-lime-300">{alunoNome}</span>
                </p>

                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full ${badgeClass(badge.kind)}`}>{badge.label}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${badgeClass(isAtivo ? "ok" : "bad")}`}>
                    {isAtivo ? "Ativo" : "Inativo"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-12 px-6 pb-6 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="text-sm text-white/60">
              <p className="text-white/80 font-semibold">Contato</p>
              <p className="mt-1">{aluno.email || "—"}</p>
              <p className="mt-1">{aluno.telefone ? onlyDigits(aluno.telefone) : "—"}</p>

              {aluno.instagram ? (
                <p className="mt-2 text-white/80">
                  Instagram: <span className="text-lime-300">{aluno.instagram}</span>
                </p>
              ) : null}

              {aluno.bio ? <p className="mt-3 text-white/60 max-w-2xl">{aluno.bio}</p> : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {wa ? (
                <a
                  href={wa}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl border border-lime-400/20 bg-lime-400/10 px-4 py-2 text-sm text-lime-200 hover:bg-lime-400/15 transition"
                >
                  WhatsApp
                </a>
              ) : (
                <span className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/30">
                  WhatsApp (sem telefone)
                </span>
              )}

              {isAtivo ? (
                <button
                  disabled={saving}
                  onClick={handleInativarAluno}
                  className="rounded-2xl bg-yellow-500 px-4 py-2 text-sm font-bold text-black hover:bg-yellow-400 disabled:opacity-50"
                >
                  Inativar
                </button>
              ) : (
                <button
                  disabled={saving}
                  onClick={handleAtivarAluno}
                  className="rounded-2xl bg-lime-400 px-4 py-2 text-sm font-bold text-black hover:bg-lime-300 disabled:opacity-50"
                >
                  Ativar
                </button>
              )}

              <button
                disabled={saving}
                onClick={handleExcluirAlunoSoft}
                className="rounded-2xl border border-red-400/25 bg-red-400/10 px-4 py-2 text-sm text-red-200 hover:bg-red-400/15 disabled:opacity-50"
              >
                Remover aluno
              </button>
            </div>
          </div>
        </div>

        {/* AÇÕES (atalhos) */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <Link
            href={`/professor/alunos/${alunoId}/anamnese`}
            className="rounded-3xl border border-white/10 bg-white/5 p-5 hover:bg-white/10 transition"
          >
            <p className="font-bold text-white">Anamnese</p>
            <p className="mt-1 text-sm text-white/60">Ver e editar informações de saúde</p>
          </Link>

          <Link
            href={`/professor/alunos/${alunoId}/arquivos`}
            className="rounded-3xl border border-white/10 bg-white/5 p-5 hover:bg-white/10 transition"
          >
            <p className="font-bold text-white">Arquivos</p>
            <p className="mt-1 text-sm text-white/60">Exames, PDFs e documentos</p>
          </Link>

          <Link
            href={`/professor/alunos/${alunoId}/atribuir-treino`}
            className="rounded-3xl border border-white/10 bg-white/5 p-5 hover:bg-white/10 transition"
          >
            <p className="font-bold text-white">Atribuir treino</p>
            <p className="mt-1 text-sm text-white/60">Montar rotina e enviar plano</p>
          </Link>

          <Link
            href={`/professor/alunos/${alunoId}/progresso-aluno`}
            className="rounded-3xl border border-white/10 bg-white/5 p-5 hover:bg-white/10 transition"
          >
            <p className="font-bold text-white">Progresso</p>
            <p className="mt-1 text-sm text-white/60">Evolução e registros</p>
          </Link>

          <Link
            href={`/professor/alunos/${alunoId}/treinos-extras`}
            className="rounded-3xl border border-white/10 bg-white/5 p-5 hover:bg-white/10 transition"
          >
            <p className="font-bold text-white">Treinos extras</p>
            <p className="mt-1 text-sm text-white/60">Complementos e condicionamento</p>
          </Link>

          <Link
            href={`/professor/alunos/${alunoId}/financeiro`}
            className="rounded-3xl border border-white/10 bg-white/5 p-5 hover:bg-white/10 transition"
          >
            <p className="font-bold text-white">Financeiro</p>
            <p className="mt-1 text-sm text-white/60">Assinatura, status e datas</p>
          </Link>
        </div>

        {/* Rodapé pequeno */}
        <div className="mt-10 text-center text-xs text-white/40">Motion — gestão premium.</div>
      </div>
    </main>
  );
}