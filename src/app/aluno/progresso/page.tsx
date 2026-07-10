"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase-browser";
import Image from "next/image";
import Link from "next/link";
import { v4 as uuidv4 } from "uuid";

type TipoFoto = "frente" | "costas" | "perfil_direito" | "perfil_esquerdo";

const TIPOS: { value: TipoFoto; label: string }[] = [
  { value: "frente", label: "Frente" },
  { value: "costas", label: "Costas" },
  { value: "perfil_direito", label: "Perfil Direito" },
  { value: "perfil_esquerdo", label: "Perfil Esquerdo" },
];

interface ProgressoFoto {
  id: string;
  url: string;
  descricao: string | null;
  data_foto: string | null;
  tipo_foto: TipoFoto | "outro" | null;
  created_at: string;
}

interface MedidaCorporal {
  id: string;
  data_medicao: string;
  peso_kg: number | null;
  altura_cm: number | null;
  braco_cm: number | null;
  cintura_cm: number | null;
  quadril_cm: number | null;
  coxa_cm: number | null;
  observacoes: string | null;
}

const CAMPOS_MEDIDA: { key: keyof MedidaCorporal; label: string; suffix: string }[] = [
  { key: "peso_kg", label: "Peso", suffix: "kg" },
  { key: "altura_cm", label: "Altura", suffix: "cm" },
  { key: "braco_cm", label: "Braço", suffix: "cm" },
  { key: "cintura_cm", label: "Cintura", suffix: "cm" },
  { key: "quadril_cm", label: "Quadril", suffix: "cm" },
  { key: "coxa_cm", label: "Coxa", suffix: "cm" },
];

function formatDateBR(iso: string) {
  try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return iso; }
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
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

  const [dataSessao, setDataSessao] = useState(todayISO());
  const [arquivosPorTipo, setArquivosPorTipo] = useState<Record<TipoFoto, File | null>>({
    frente: null,
    costas: null,
    perfil_direito: null,
    perfil_esquerdo: null,
  });

  const [medidas, setMedidas] = useState<MedidaCorporal[]>([]);
  const [medidaForm, setMedidaForm] = useState({
    data_medicao: todayISO(),
    peso_kg: "",
    altura_cm: "",
    braco_cm: "",
    cintura_cm: "",
    quadril_cm: "",
    coxa_cm: "",
    observacoes: "",
  });
  const [isSubmittingMedida, setIsSubmittingMedida] = useState(false);

  const totalSelecionado = useMemo(
    () => Object.values(arquivosPorTipo).filter(Boolean).length,
    [arquivosPorTipo]
  );
  const canSubmit = totalSelecionado > 0 && !!alunoId && !isSubmitting;

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

      const { data: medidasData, error: medidasError } = await supabase
        .from("medidas_corporais").select("*").eq("aluno_id", user.id)
        .order("data_medicao", { ascending: false });

      if (!medidasError) setMedidas((medidasData as MedidaCorporal[]) || []);

      setPageLoading(false);
    }
    load();
  }, [router]);

  async function handleAddMedida(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setOkMsg(null);
    if (!alunoId) { setError("Sessão expirada."); return; }
    setIsSubmittingMedida(true);

    try {
      const toNum = (v: string) => (v.trim() === "" ? null : Number(v));
      const payload = {
        aluno_id: alunoId,
        data_medicao: medidaForm.data_medicao,
        peso_kg: toNum(medidaForm.peso_kg),
        altura_cm: toNum(medidaForm.altura_cm),
        braco_cm: toNum(medidaForm.braco_cm),
        cintura_cm: toNum(medidaForm.cintura_cm),
        quadril_cm: toNum(medidaForm.quadril_cm),
        coxa_cm: toNum(medidaForm.coxa_cm),
        observacoes: medidaForm.observacoes.trim() || null,
      };

      const { data, error: dbError } = await supabase
        .from("medidas_corporais").insert(payload).select().single();
      if (dbError) throw dbError;

      setMedidas((prev) => [data as MedidaCorporal, ...prev]);
      setMedidaForm({
        data_medicao: todayISO(), peso_kg: "", altura_cm: "",
        braco_cm: "", cintura_cm: "", quadril_cm: "", coxa_cm: "", observacoes: "",
      });
      setOkMsg("Medidas registradas!");
    } catch (err: any) {
      setError(`Erro ao registrar medidas: ${err?.message || "erro desconhecido"}`);
    } finally {
      setIsSubmittingMedida(false);
    }
  }

  async function handleDeleteMedida(id: string) {
    setIsSubmittingMedida(true);
    setError(null); setOkMsg(null);
    try {
      const { error: dbErr } = await supabase.from("medidas_corporais").delete().eq("id", id);
      if (dbErr) throw dbErr;
      setMedidas((prev) => prev.filter((m) => m.id !== id));
      setOkMsg("Registro excluído.");
    } catch (err: any) {
      setError(`Erro ao excluir: ${err?.message || "erro desconhecido"}`);
    } finally {
      setIsSubmittingMedida(false);
    }
  }

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
    if (!alunoId) { setError("Sessão expirada."); return; }
    if (totalSelecionado === 0) { setError("Selecione pelo menos uma foto."); return; }
    setIsSubmitting(true);

    try {
      const inseridas: ProgressoFoto[] = [];

      for (const { value: tipo } of TIPOS) {
        const arquivo = arquivosPorTipo[tipo];
        if (!arquivo) continue;

        const safeExt = (arquivo.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        const filePath = `${alunoId}/${uuidv4()}.${safeExt}`;

        const { error: uploadError } = await supabase.storage.from("progressphotos")
          .upload(filePath, arquivo, { upsert: true, contentType: arquivo.type || "image/jpeg", cacheControl: "3600" });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("progressphotos").getPublicUrl(filePath);
        const publicUrl = urlData?.publicUrl;
        if (!publicUrl) throw new Error("URL pública não obtida.");

        const { data: dbData, error: dbError } = await supabase.from("progresso_fotos")
          .insert({ aluno_id: alunoId, url: publicUrl, data_foto: dataSessao, tipo_foto: tipo })
          .select().single();
        if (dbError) throw dbError;

        inseridas.push(dbData as ProgressoFoto);
      }

      setFotos((prev) => [...inseridas, ...prev]);
      setArquivosPorTipo({ frente: null, costas: null, perfil_direito: null, perfil_esquerdo: null });
      setOkMsg(`${inseridas.length} foto(s) enviada(s) com sucesso!`);
    } catch (err: any) {
      setError(`Erro ao enviar foto: ${err?.message || "erro desconhecido"}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Agrupa fotos por data (sessão) pra exibição
  const sessoes = useMemo(() => {
    const grupos = new Map<string, ProgressoFoto[]>();
    for (const f of fotos) {
      const chave = f.data_foto || f.created_at.slice(0, 10);
      if (!grupos.has(chave)) grupos.set(chave, []);
      grupos.get(chave)!.push(f);
    }
    return Array.from(grupos.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [fotos]);

  function labelTipo(tipo: string | null) {
    if (!tipo) return "Sem ângulo definido";
    return TIPOS.find((t) => t.value === tipo)?.label ?? "Outro";
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

        <div>
          <h1 className="text-2xl font-bold text-white">Meu Progresso</h1>
          <p className="text-white/50 text-sm mt-1">
            Envie fotos de frente, costas e perfil na mesma data — isso ajuda seu professor (e a IA) a avaliar sua postura e evolução com mais precisão.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</div>
        )}
        {okMsg && (
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">{okMsg}</div>
        )}

        {/* Upload form */}
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
          <h2 className="font-semibold text-white mb-4">Nova sessão de fotos</h2>
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="text-sm text-white/60">Data da sessão</label>
              <input type="date" value={dataSessao} onChange={(e) => setDataSessao(e.target.value)} required
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-white/25 transition-colors" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {TIPOS.map((t) => (
                <div key={t.value}>
                  <label className="text-sm text-white/60">{t.label}</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setArquivosPorTipo((prev) => ({ ...prev, [t.value]: e.target.files?.[0] || null }))}
                    className="mt-1.5 block w-full text-xs text-white/60 file:mr-2 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-black hover:file:bg-white/90 transition-colors"
                  />
                  {arquivosPorTipo[t.value] && (
                    <p className="text-[11px] text-white/40 mt-1 truncate">{arquivosPorTipo[t.value]!.name}</p>
                  )}
                </div>
              ))}
            </div>

            <p className="text-[11px] text-white/40">Preencha pelo menos uma posição. Não precisa enviar as 4 de uma vez.</p>

            <button type="submit" disabled={!canSubmit}
              className="w-full rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-60 transition-colors">
              {isSubmitting ? "Enviando…" : `Enviar ${totalSelecionado > 0 ? `(${totalSelecionado})` : ""}`}
            </button>
          </form>
        </div>

        {/* Gallery agrupada por sessão */}
        {sessoes.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-8 text-center">
            <p className="text-white/40 text-sm">Você ainda não enviou fotos de progresso.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sessoes.map(([data, fotosSessao]) => (
              <div key={data} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-sm font-semibold text-white/80 mb-3">{formatDateBR(data)}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {fotosSessao.map((foto) => (
                    <div key={foto.id} className="rounded-xl border border-white/8 bg-white/[0.03] overflow-hidden">
                      <div className="relative w-full h-36 overflow-hidden">
                        <ProgressPhoto src={foto.url} alt={labelTipo(foto.tipo_foto)} />
                      </div>
                      <div className="px-2 py-2 flex items-center justify-between gap-1">
                        <p className="text-[11px] font-medium text-white/70 truncate">{labelTipo(foto.tipo_foto)}</p>
                        <button
                          onClick={() => handleDeleteFoto(foto)}
                          disabled={isSubmitting}
                          className="shrink-0 rounded-lg border border-red-400/20 bg-red-400/10 px-1.5 py-0.5 text-[9px] text-red-300 hover:bg-red-400/15 disabled:opacity-50 transition-colors"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Medidas corporais */}
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
          <h2 className="font-semibold text-white mb-1">Medidas corporais</h2>
          <p className="text-white/50 text-sm mb-4">
            Meça com fita métrica e registre periodicamente — ajuda a acompanhar sua evolução além da balança.
          </p>
          <form onSubmit={handleAddMedida} className="space-y-4">
            <div>
              <label className="text-sm text-white/60">Data da medição</label>
              <input type="date" value={medidaForm.data_medicao}
                onChange={(e) => setMedidaForm((p) => ({ ...p, data_medicao: e.target.value }))} required
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-white/25 transition-colors" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {CAMPOS_MEDIDA.map(({ key, label, suffix }) => (
                <div key={key}>
                  <label className="text-sm text-white/60">{label} ({suffix})</label>
                  <input
                    type="number" step="0.1" inputMode="decimal"
                    value={medidaForm[key as Exclude<keyof typeof medidaForm, "data_medicao" | "observacoes">]}
                    onChange={(e) => setMedidaForm((p) => ({ ...p, [key]: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-white/25 transition-colors"
                  />
                </div>
              ))}
            </div>

            <div>
              <label className="text-sm text-white/60">Observações (opcional)</label>
              <input type="text" value={medidaForm.observacoes}
                onChange={(e) => setMedidaForm((p) => ({ ...p, observacoes: e.target.value }))}
                placeholder="Ex: medi em jejum, pela manhã"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-white/25 transition-colors" />
            </div>

            <button type="submit" disabled={isSubmittingMedida || !alunoId}
              className="w-full rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-60 transition-colors">
              {isSubmittingMedida ? "Salvando…" : "Registrar medidas"}
            </button>
          </form>

          {medidas.length > 0 && (
            <div className="mt-6 space-y-2">
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-2">Histórico</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-white/40 text-xs">
                      <th className="pb-2 pr-3">Data</th>
                      {CAMPOS_MEDIDA.map(({ key, label }) => (
                        <th key={key} className="pb-2 pr-3">{label}</th>
                      ))}
                      <th className="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {medidas.map((m) => (
                      <tr key={m.id} className="border-t border-white/8 text-white/80">
                        <td className="py-2 pr-3 whitespace-nowrap">{formatDateBR(m.data_medicao)}</td>
                        {CAMPOS_MEDIDA.map(({ key, suffix }) => (
                          <td key={key} className="py-2 pr-3 whitespace-nowrap">
                            {m[key] != null ? `${m[key]}${suffix}` : "—"}
                          </td>
                        ))}
                        <td className="py-2">
                          <button onClick={() => handleDeleteMedida(m.id)} disabled={isSubmittingMedida}
                            className="rounded-lg border border-red-400/20 bg-red-400/10 px-1.5 py-0.5 text-[9px] text-red-300 hover:bg-red-400/15 disabled:opacity-50 transition-colors">
                            Excluir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
