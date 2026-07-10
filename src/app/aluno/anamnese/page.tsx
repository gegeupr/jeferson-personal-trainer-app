"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase-browser";
import Link from "next/link";

interface AnamneseData {
  id: string;
  aluno_id: string;
  data_preenchimento: string;
  peso_kg: number | null;
  altura_cm: number | null;
  condicoes_saude: string[] | null;
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

const CONDICOES_SAUDE: { value: string; label: string }[] = [
  { value: "lesao_joelho", label: "Lesão no joelho" },
  { value: "lesao_ombro", label: "Lesão no ombro" },
  { value: "lesao_lombar", label: "Lesão lombar / hérnia de disco" },
  { value: "lesao_cotovelo", label: "Lesão no cotovelo" },
  { value: "lesao_punho", label: "Lesão no punho" },
  { value: "lesao_tornozelo", label: "Lesão no tornozelo" },
  { value: "lesao_quadril", label: "Lesão no quadril" },
  { value: "hipertensao", label: "Hipertensão" },
  { value: "diabetes", label: "Diabetes" },
  { value: "cardiopatia", label: "Problema cardíaco" },
  { value: "gravidez", label: "Gestante" },
  { value: "asma", label: "Asma / problema respiratório" },
];

export default function MinhaAnamnesePage() {
  const router = useRouter();
  const [alunoId, setAlunoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [anamnese, setAnamnese] = useState<AnamneseData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    peso_kg: null,
    altura_cm: null,
    condicoes_saude: [],
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
          peso_kg: data.peso_kg ?? null,
          altura_cm: data.altura_cm ?? null,
          condicoes_saude: data.condicoes_saude || [],
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

  function handleNumberChange(name: "peso_kg" | "altura_cm", value: string) {
    setFormData((prev) => ({ ...prev, [name]: value === "" ? null : Number(value) }));
  }

  function toggleCondicao(value: string) {
    setFormData((prev) => {
      const atual = prev.condicoes_saude || [];
      const novo = atual.includes(value) ? atual.filter((c) => c !== value) : [...atual, value];
      return { ...prev, condicoes_saude: novo };
    });
  }

  const imc = formData.peso_kg && formData.altura_cm
    ? (formData.peso_kg / ((formData.altura_cm / 100) ** 2)).toFixed(1)
    : null;

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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-white/60">Peso (kg)</label>
              <input type="number" step="0.1" min="0" value={formData.peso_kg ?? ""} onChange={(e) => handleNumberChange("peso_kg", e.target.value)}
                className={inputClass} placeholder="Ex: 72.5" />
            </div>
            <div>
              <label className="text-sm text-white/60">Altura (cm)</label>
              <input type="number" step="1" min="0" value={formData.altura_cm ?? ""} onChange={(e) => handleNumberChange("altura_cm", e.target.value)}
                className={inputClass} placeholder="Ex: 175" />
            </div>
          </div>
          {imc && (
            <p className="text-xs text-white/40 -mt-3">IMC calculado: <span className="text-white/70 font-medium">{imc}</span></p>
          )}

          <div>
            <label className="text-sm text-white/60">Condições de saúde (marque as que se aplicam)</label>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CONDICOES_SAUDE.map((c) => {
                const marcado = (formData.condicoes_saude || []).includes(c.value);
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => toggleCondicao(c.value)}
                    className={`rounded-xl border px-3 py-2 text-xs font-medium text-left transition-colors ${
                      marcado
                        ? "border-white/25 bg-white/10 text-white"
                        : "border-white/10 bg-black/40 text-white/50 hover:bg-white/5"
                    }`}
                  >
                    {marcado ? "✓ " : ""}{c.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-white/35 mt-1.5">Isso ajuda a IA a evitar exercícios contraindicados automaticamente.</p>
          </div>

          <div>
            <label className="text-sm text-white/60">Histórico de saúde e doenças (detalhe, se necessário)</label>
            <textarea name="historico_saude_doencas" rows={3} value={formData.historico_saude_doencas || ""} onChange={handleChange}
              className={inputClass + " resize-none"} placeholder="Ex: Diabetes controlada com medicação desde 2020…" />
          </div>

          <div>
            <label className="text-sm text-white/60">Histórico de lesões e cirurgias (detalhe, se necessário)</label>
            <textarea name="historico_lesoes_cirurgias" rows={3} value={formData.historico_lesoes_cirurgias || ""} onChange={handleChange}
              className={inputClass + " resize-none"} placeholder="Ex: Cirurgia no joelho direito em 2022, ainda sinto desconforto em agachamento profundo…" />
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
