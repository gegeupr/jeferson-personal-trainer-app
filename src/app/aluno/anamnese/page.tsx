"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase-browser";
import Link from "next/link";

interface AnamneseData {
  id: string;
  aluno_id: string;
  data_preenchimento: string;
  historico_saude_doencas: string | null;
  historico_lesoes_cirurgias: string | null;
  medicamentos_suplementos: string | null;
  alergias: string | null;
  fumante_alcool: string | null;
  nivel_atividade_fisica_atual: string | null;
  objetivos_principais: string | null;
  restricoes_alimentares: string | null;
  disponibilidade_treino: string | null;
  observacoes_gerais: string | null;
}

type FormData = Omit<AnamneseData, "id" | "aluno_id" | "data_preenchimento">;

const inputClass = "mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-white/25 transition-colors";

export default function MinhaAnamnesePage() {
  const router = useRouter();
  const [alunoId, setAlunoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [anamnese, setAnamnese] = useState<AnamneseData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    historico_saude_doencas: "",
    historico_lesoes_cirurgias: "",
    medicamentos_suplementos: "",
    alergias: "",
    fumante_alcool: "",
    nivel_atividade_fisica_atual: "",
    objetivos_principais: "",
    restricoes_alimentares: "",
    disponibilidade_treino: "",
    observacoes_gerais: "",
  });

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { router.push("/login"); return; }
      setAlunoId(user.id);

      const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (profileError || profile?.role !== "aluno") { router.push("/dashboard"); return; }

      const { data, error: fetchError } = await supabase.from("anamneses").select("*").eq("aluno_id", user.id).single();

      if (fetchError && fetchError.code !== "PGRST116") {
        setError("Não foi possível carregar sua anamnese.");
      } else if (data) {
        setAnamnese(data as AnamneseData);
        setFormData({
          historico_saude_doencas: data.historico_saude_doencas || "",
          historico_lesoes_cirurgias: data.historico_lesoes_cirurgias || "",
          medicamentos_suplementos: data.medicamentos_suplementos || "",
          alergias: data.alergias || "",
          fumante_alcool: data.fumante_alcool || "",
          nivel_atividade_fisica_atual: data.nivel_atividade_fisica_atual || "",
          objetivos_principais: data.objetivos_principais || "",
          restricoes_alimentares: data.restricoes_alimentares || "",
          disponibilidade_treino: data.disponibilidade_treino || "",
          observacoes_gerais: data.observacoes_gerais || "",
        });
      }
      setLoading(false);
    }
    load();
  }, [router]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setOkMsg(null);

    if (!alunoId) { setError("ID do aluno não encontrado."); setIsSubmitting(false); return; }

    try {
      if (anamnese) {
        const { error: updateError } = await supabase.from("anamneses").update(formData).eq("aluno_id", alunoId);
        if (updateError) throw updateError;
        setOkMsg("Anamnese atualizada com sucesso!");
      } else {
        const { error: insertError } = await supabase.from("anamneses").insert({ ...formData, aluno_id: alunoId });
        if (insertError) throw insertError;
        setOkMsg("Anamnese salva com sucesso!");
      }

      const { data } = await supabase.from("anamneses").select("*").eq("aluno_id", alunoId).single();
      if (data) setAnamnese(data as AnamneseData);
    } catch (err: unknown) {
      setError(err instanceof Error ? "Erro ao salvar: " + err.message : "Erro ao salvar anamnese.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-white/40 text-sm">Carregando anamnese…</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white px-4 py-8 pb-16">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-2 text-sm text-white/40">
          <Link href="/aluno/dashboard" className="hover:text-white/70 transition-colors">Dashboard</Link>
          <span>/</span>
          <span className="text-white/60">Anamnese</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-white">{anamnese ? "Editar Anamnese" : "Preencher Anamnese"}</h1>
          <p className="text-white/50 text-sm mt-1">Informações de saúde para seu professor personalizar seus treinos.</p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</div>
        )}
        {okMsg && (
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">{okMsg}</div>
        )}

        <form onSubmit={handleSubmit} className="rounded-2xl border border-white/8 bg-white/[0.03] p-6 space-y-5">
          <div>
            <label className="text-sm text-white/60">Histórico de saúde e doenças</label>
            <textarea name="historico_saude_doencas" rows={3} value={formData.historico_saude_doencas || ""} onChange={handleChange}
              className={inputClass + " resize-none"} placeholder="Ex: Diabetes, hipertensão, problemas cardíacos…" />
          </div>

          <div>
            <label className="text-sm text-white/60">Histórico de lesões e cirurgias</label>
            <textarea name="historico_lesoes_cirurgias" rows={3} value={formData.historico_lesoes_cirurgias || ""} onChange={handleChange}
              className={inputClass + " resize-none"} placeholder="Ex: Cirurgia no joelho, dores lombares, tendinite…" />
          </div>

          <div>
            <label className="text-sm text-white/60">Medicamentos e suplementos (uso contínuo)</label>
            <textarea name="medicamentos_suplementos" rows={2} value={formData.medicamentos_suplementos || ""} onChange={handleChange}
              className={inputClass + " resize-none"} placeholder="Ex: Insulina, anti-inflamatórios, whey protein…" />
          </div>

          <div>
            <label className="text-sm text-white/60">Alergias</label>
            <input type="text" name="alergias" value={formData.alergias || ""} onChange={handleChange}
              className={inputClass} placeholder="Ex: Alergia a algum alimento, medicamento…" />
          </div>

          <div>
            <label className="text-sm text-white/60">Fumante / Consumo de álcool</label>
            <select name="fumante_alcool" value={formData.fumante_alcool || ""} onChange={handleChange} className={inputClass}>
              <option value="">Selecione</option>
              <option value="Nao Fumante / Nao Consumo">Não Fumante / Não Consumo</option>
              <option value="Fumante / Nao Consumo">Fumante / Não Consumo</option>
              <option value="Nao Fumante / Consumo Moderado">Não Fumante / Consumo Moderado</option>
              <option value="Fumante / Consumo Moderado">Fumante / Consumo Moderado</option>
              <option value="Fumante / Consumo Excessivo">Fumante / Consumo Excessivo</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-white/60">Nível de atividade física atual</label>
            <select name="nivel_atividade_fisica_atual" value={formData.nivel_atividade_fisica_atual || ""} onChange={handleChange} className={inputClass}>
              <option value="">Selecione</option>
              <option value="Sedentario">Sedentário</option>
              <option value="Pouco Ativo">Pouco Ativo</option>
              <option value="Ativo">Ativo</option>
              <option value="Muito Ativo">Muito Ativo</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-white/60">Objetivos principais com o treino</label>
            <textarea name="objetivos_principais" rows={3} value={formData.objetivos_principais || ""} onChange={handleChange}
              className={inputClass + " resize-none"} placeholder="Ex: Perder peso, ganhar massa, melhorar condicionamento…" />
          </div>

          <div>
            <label className="text-sm text-white/60">Restrições alimentares ou dieta</label>
            <textarea name="restricoes_alimentares" rows={2} value={formData.restricoes_alimentares || ""} onChange={handleChange}
              className={inputClass + " resize-none"} placeholder="Ex: Vegetariano, vegano, intolerância à lactose…" />
          </div>

          <div>
            <label className="text-sm text-white/60">Disponibilidade para treinar (dias/horários)</label>
            <textarea name="disponibilidade_treino" rows={2} value={formData.disponibilidade_treino || ""} onChange={handleChange}
              className={inputClass + " resize-none"} placeholder="Ex: Seg, Qua, Sex - 18h às 19h…" />
          </div>

          <div>
            <label className="text-sm text-white/60">Observações gerais</label>
            <textarea name="observacoes_gerais" rows={3} value={formData.observacoes_gerais || ""} onChange={handleChange}
              className={inputClass + " resize-none"} placeholder="Condições médicas importantes, metas de longo prazo…" />
          </div>

          <button type="submit" disabled={isSubmitting}
            className="w-full rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-60 transition-colors">
            {isSubmitting ? "Salvando…" : "Salvar anamnese"}
          </button>
        </form>
      </div>
    </main>
  );
}
