"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase-browser";
import Link from "next/link";
import { v4 as uuidv4 } from "uuid";

interface Arquivo {
  id: string;
  nome_arquivo: string;
  url: string;
  aluno_id: string;
  professor_id: string;
  tipo: string | null;
  created_at: string;
  public_id: string;
}

export default function ArquivosPage() {
  const router = useRouter();
  const [alunoId, setAlunoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [arquivos, setArquivos] = useState<Arquivo[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { router.push("/login"); return; }
      setAlunoId(user.id);

      const { data, error: arquivosError } = await supabase
        .from("arquivos").select("*").eq("aluno_id", user.id).order("created_at", { ascending: false });

      if (arquivosError) setError("Não foi possível carregar seus arquivos.");
      else setArquivos(data || []);
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setOkMsg(null);
    if (!alunoId || !arquivoSelecionado || !nomeArquivo.trim()) {
      setError("Preencha o nome e selecione um arquivo.");
      return;
    }
    setIsSubmitting(true);

    try {
      const fileExt = arquivoSelecionado.name.split(".").pop();
      const filePath = `${alunoId}/${uuidv4()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from("arquivo").upload(filePath, arquivoSelecionado);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("arquivo").getPublicUrl(filePath);
      if (!urlData) throw new Error("URL pública não obtida.");

      const { data: dbData, error: dbError } = await supabase.from("arquivos")
        .insert({ aluno_id: alunoId, nome_arquivo: nomeArquivo.trim(), url: urlData.publicUrl, tipo: arquivoSelecionado.type, public_id: filePath })
        .select().single();
      if (dbError) throw dbError;

      setArquivos((prev) => [dbData, ...prev]);
      setNomeArquivo(""); setArquivoSelecionado(null);
      setOkMsg("Arquivo enviado com sucesso!");
    } catch (err: unknown) {
      setError(err instanceof Error ? `Erro ao enviar: ${err.message}` : "Erro desconhecido.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(arquivoId: string) {
    const arq = arquivos.find((a) => a.id === arquivoId);
    if (!arq) return;
    setIsSubmitting(true); setError(null); setOkMsg(null);

    try {
      const { error: storageErr } = await supabase.storage.from("arquivo").remove([arq.public_id]);
      if (storageErr) throw storageErr;

      const { error: dbErr } = await supabase.from("arquivos").delete().eq("id", arquivoId);
      if (dbErr) throw dbErr;

      setArquivos((prev) => prev.filter((a) => a.id !== arquivoId));
      setOkMsg("Arquivo excluído.");
    } catch (err: unknown) {
      setError(err instanceof Error ? `Erro ao excluir: ${err.message}` : "Erro desconhecido.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-white/40 text-sm">Carregando arquivos…</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white px-4 py-8 pb-16">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center gap-2 text-sm text-white/40">
          <Link href="/aluno/dashboard" className="hover:text-white/70 transition-colors">Dashboard</Link>
          <span>/</span>
          <span className="text-white/60">Meus Arquivos</span>
        </div>

        <h1 className="text-2xl font-bold text-white">Meus Arquivos</h1>

        {error && (
          <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</div>
        )}
        {okMsg && (
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">{okMsg}</div>
        )}

        {/* Upload */}
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
          <h2 className="font-semibold text-white mb-4">Enviar novo arquivo</h2>
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="text-sm text-white/60">Nome do arquivo</label>
              <input type="text" value={nomeArquivo} onChange={(e) => setNomeArquivo(e.target.value)} required
                placeholder="Ex: Exame de Sangue de Junho"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm outline-none focus:border-white/25 transition-colors" />
            </div>
            <div>
              <label className="text-sm text-white/60">Arquivo</label>
              <input type="file" onChange={(e) => setArquivoSelecionado(e.target.files?.[0] || null)} required
                className="mt-1.5 block w-full text-sm text-white/60 file:mr-3 file:rounded-xl file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black hover:file:bg-white/90 transition-colors" />
              {arquivoSelecionado && <p className="text-xs text-white/40 mt-1">{arquivoSelecionado.name}</p>}
            </div>
            <button type="submit" disabled={isSubmitting}
              className="w-full rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-60 transition-colors">
              {isSubmitting ? "Enviando…" : "Enviar arquivo"}
            </button>
          </form>
        </div>

        {/* List */}
        {arquivos.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-8 text-center">
            <p className="text-white/40 text-sm">Você ainda não enviou nenhum arquivo.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] divide-y divide-white/8">
            {arquivos.map((arq) => (
              <div key={arq.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <a href={arq.url} target="_blank" rel="noopener noreferrer"
                    className="font-medium text-white hover:text-white/70 transition-colors truncate block">
                    {arq.nome_arquivo}
                  </a>
                  <p className="text-xs text-white/40 mt-0.5">
                    {arq.tipo || "arquivo"} · {new Date(arq.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <button onClick={() => handleDelete(arq.id)} disabled={isSubmitting}
                  className="shrink-0 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-1.5 text-xs text-red-300 hover:bg-red-400/15 disabled:opacity-50 transition-colors">
                  Excluir
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
