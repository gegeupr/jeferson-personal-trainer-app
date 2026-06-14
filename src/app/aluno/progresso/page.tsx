"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase-browser";
import Image from "next/image";
import Link from "next/link";
import { v4 as uuidv4 } from "uuid";

interface ProgressoFoto {
  id: string;
  url: string;
  descricao: string | null;
  data_foto: string | null;
  created_at: string;
}

function formatDateBR(iso: string) {
  try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return iso; }
}

function ProgressPhoto({ src, alt }: { src: string; alt: string }) {
  const [fallback, setFallback] = useState(false);
  if (fallback) return <img src={src} alt={alt} className="w-full h-full object-cover" />;
  return (
    <Image src={src} alt={alt} fill unoptimized className="object-cover"
      sizes="(max-width: 768px) 50vw, 33vw" onError={() => setFallback(true)} />
  );
}

export default function MeuProgressoPage() {
  const router = useRouter();

  const [alunoId, setAlunoId] = useState<string | null>(null);
  const [fotos, setFotos] = useState<ProgressoFoto[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [fotoSelecionada, setFotoSelecionada] = useState<File | null>(null);
  const [descricaoFoto, setDescricaoFoto] = useState("");
  const [dataFoto, setDataFoto] = useState("");

  const canSubmit = useMemo(() => !!fotoSelecionada && !!alunoId && !isSubmitting, [fotoSelecionada, alunoId, isSubmitting]);

  useEffect(() => {
    async function load() {
      setPageLoading(true);
      setError(null);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { router.push("/login"); return; }

      setAlunoId(user.id);

      const { data, error: fetchError } = await supabase
        .from("progresso_fotos").select("*").eq("aluno_id", user.id)
        .order("data_foto", { ascending: false }).order("created_at", { ascending: false });

      if (fetchError) setError("Não foi possível carregar suas fotos.");
      else setFotos((data as ProgressoFoto[]) || []);

      setPageLoading(false);
    }
    load();
  }, [router]);

  async function handleDeleteFoto(foto: ProgressoFoto) {
    setIsSubmitting(true);
    setError(null);
    setOkMsg(null);
    try {
      const marker = "/progressphotos/";
      const idx = foto.url.indexOf(marker);
      if (idx !== -1) {
        const storagePath = foto.url.slice(idx + marker.length).split("?")[0];
        await supabase.storage.from("progressphotos").remove([storagePath]);
      }
      const { error: dbErr } = await supabase.from("progresso_fotos").delete().eq("id", foto.id);
      if (dbErr) throw dbErr;
      setFotos((prev) => prev.filter((f) => f.id !== foto.id));
      setOkMsg("Foto excluída.");
    } catch (err: any) {
      setError(`Erro ao excluir: ${err?.message || "erro desconhecido"}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setOkMsg(null);
    if (!alunoId || !fotoSelecionada) { setError("Selecione uma foto."); return; }
    setIsSubmitting(true);

    try {
      const safeExt = (fotoSelecionada.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const filePath = `${alunoId}/${uuidv4()}.${safeExt}`;

      const { error: uploadError } = await supabase.storage.from("progressphotos").upload(filePath, fotoSelecionada, { upsert: true, contentType: fotoSelecionada.type || "image/jpeg", cacheControl: "3600" });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("progressphotos").getPublicUrl(filePath);
      const publicUrl = urlData?.publicUrl;
      if (!publicUrl) throw new Error("URL pública não obtida.");

      const { data: dbData, error: dbError } = await supabase.from("progresso_fotos")
        .insert({ aluno_id: alunoId, url: publicUrl, descricao: descricaoFoto.trim() || null, data_foto: dataFoto || null })
        .select().single();
      if (dbError) throw dbError;

      setFotos((prev) => [dbData as ProgressoFoto, ...prev]);
      setFotoSelecionada(null); setDescricaoFoto(""); setDataFoto("");
      setOkMsg("Foto enviada com sucesso!");
    } catch (err: any) {
      setError(`Erro ao enviar foto: ${err?.message || "erro desconhecido"}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (pageLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-white/40 text-sm">Carregando fotos…</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white px-4 py-8 pb-16">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-2 text-sm text-white/40">
          <Link href="/aluno/dashboard" className="hover:text-white/70 transition-colors">Dashboard</Link>
          <span>/</span>
          <span className="text-white/60">Meu Progresso</span>
        </div>

        <h1 className="text-2xl font-bold text-white">Meu Progresso</h1>

        {error && (
          <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</div>
        )}
        {okMsg && (
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">{okMsg}</div>
        )}

        {/* Upload form */}
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
          <h2 className="font-semibold text-white mb-4">Enviar nova foto</h2>
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="text-sm text-white/60">Foto</label>
              <input type="file" accept="image/*" onChange={(e) => setFotoSelecionada(e.target.files?.[0] || null)} required
                className="mt-1.5 block w-full text-sm text-white/60 file:mr-3 file:rounded-xl file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black hover:file:bg-white/90 transition-colors" />
              {fotoSelecionada && <p className="text-xs text-white/40 mt-1">{fotoSelecionada.name}</p>}
            </div>

            <div>
              <label className="text-sm text-white/60">Data da foto</label>
              <input type="date" value={dataFoto} onChange={(e) => setDataFoto(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-white/25 transition-colors" />
            </div>

            <div>
              <label className="text-sm text-white/60">Descrição (opcional)</label>
              <textarea rows={2} value={descricaoFoto} onChange={(e) => setDescricaoFoto(e.target.value)} placeholder="Ex: Semana 4…"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-white/25 transition-colors resize-none" />
            </div>

            <button type="submit" disabled={!canSubmit}
              className="w-full rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-60 transition-colors">
              {isSubmitting ? "Enviando…" : "Enviar foto"}
            </button>
          </form>
        </div>

        {/* Gallery */}
        {fotos.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-8 text-center">
            <p className="text-white/40 text-sm">Você ainda não enviou fotos de progresso.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {fotos.map((foto) => (
              <div key={foto.id} className="rounded-2xl border border-white/8 bg-white/[0.03] overflow-hidden">
                <div className="relative w-full h-44 overflow-hidden">
                  <ProgressPhoto src={foto.url} alt={foto.descricao || "Foto de progresso"} />
                </div>
                <div className="px-3 py-2.5 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white/70">
                      {foto.data_foto ? formatDateBR(foto.data_foto) : formatDateBR(foto.created_at)}
                    </p>
                    {foto.descricao && <p className="text-xs text-white/40 mt-0.5 leading-relaxed">{foto.descricao}</p>}
                  </div>
                  <button
                    onClick={() => handleDeleteFoto(foto)}
                    disabled={isSubmitting}
                    className="shrink-0 rounded-lg border border-red-400/20 bg-red-400/10 px-2 py-1 text-[10px] text-red-300 hover:bg-red-400/15 disabled:opacity-50 transition-colors"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
