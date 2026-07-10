"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/utils/supabase-browser";
import Link from "next/link";

interface ProgressoFoto {
  id: string;
  url: string;
  descricao: string | null;
  data_foto: string | null;
  tipo_foto: string | null;
  created_at: string;
}

const LABEL_TIPO: Record<string, string> = {
  frente: "Frente",
  costas: "Costas",
  perfil_direito: "Perfil Direito",
  perfil_esquerdo: "Perfil Esquerdo",
};

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

interface AlunoProfile {
  nome_completo: string | null;
}

function formatDateBR(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

function ProgressPhotoImg({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="w-full h-full grid place-items-center bg-white/5 text-white/30 text-xs rounded-xl">
        imagem indisponível
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-cover"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

export default function ProgressoAlunoProfessorPage() {
  const router = useRouter();
  const params = useParams();
  const alunoId = params.alunoId as string;

  const [fotos, setFotos] = useState<ProgressoFoto[]>([]);
  const [medidas, setMedidas] = useState<MedidaCorporal[]>([]);
  const [alunoProfile, setAlunoProfile] = useState<AlunoProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProgressPhotos() {
      setLoading(true);
      setError(null);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { router.push("/login"); return; }

      const { data: profile, error: profileError } = await supabase
        .from("profiles").select("role").eq("id", user.id).single();
      if (profileError || profile?.role !== "professor") {
        setError("Acesso negado.");
        setLoading(false);
        return;
      }

      const { data: alunoData, error: alunoError } = await supabase
        .from("profiles").select("nome_completo").eq("id", alunoId).single();
      if (alunoError || !alunoData) {
        setError("Aluno não encontrado.");
        setLoading(false);
        return;
      }
      setAlunoProfile(alunoData);

      const { data: fotosData, error: fetchError } = await supabase
        .from("progresso_fotos")
        .select("*")
        .eq("aluno_id", alunoId)
        .order("data_foto", { ascending: false })
        .order("created_at", { ascending: false });

      if (fetchError) {
        setError("Não foi possível carregar as fotos de progresso.");
        setFotos([]);
      } else {
        setFotos((fotosData as ProgressoFoto[]) || []);
      }

      const { data: medidasData, error: medidasError } = await supabase
        .from("medidas_corporais")
        .select("*")
        .eq("aluno_id", alunoId)
        .order("data_medicao", { ascending: false });

      if (!medidasError) setMedidas((medidasData as MedidaCorporal[]) || []);

      setLoading(false);
    }
    fetchProgressPhotos();
  }, [router, alunoId]);

  const alunoNome = alunoProfile?.nome_completo || "Aluno";

  const sessoes = useMemo(() => {
    const grupos = new Map<string, ProgressoFoto[]>();
    for (const f of fotos) {
      const chave = f.data_foto || f.created_at.slice(0, 10);
      if (!grupos.has(chave)) grupos.set(chave, []);
      grupos.get(chave)!.push(f);
    }
    return Array.from(grupos.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [fotos]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-white/40 text-sm">Carregando fotos…</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-white/40">
          <Link href="/professor/alunos" className="hover:text-white/70 transition-colors">Alunos</Link>
          <span>/</span>
          <Link href={`/professor/alunos/${alunoId}/detalhes`} className="hover:text-white/70 transition-colors">{alunoNome}</Link>
          <span>/</span>
          <span className="text-white/60">Progresso</span>
        </div>

        <h1 className="text-2xl font-bold text-white">Progresso</h1>

        {error && (
          <div className="rounded-xl border border-red-400/15 bg-red-400/8 px-4 py-3 text-sm text-red-300">{error}</div>
        )}

        {sessoes.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-8 text-center">
            <p className="text-white/40 text-sm">O aluno ainda não enviou fotos de progresso.</p>
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
                        <ProgressPhotoImg src={foto.url} alt={LABEL_TIPO[foto.tipo_foto ?? ""] || foto.descricao || "Foto de progresso"} />
                      </div>
                      <div className="px-2 py-2">
                        <p className="text-[11px] font-medium text-white/70 truncate">
                          {LABEL_TIPO[foto.tipo_foto ?? ""] || "Sem ângulo definido"}
                        </p>
                        {foto.descricao && (
                          <p className="text-[10px] text-white/40 mt-0.5 leading-relaxed truncate">{foto.descricao}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Medidas corporais */}
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
          <p className="text-sm font-semibold text-white/80 mb-3">Medidas corporais</p>
          {medidas.length === 0 ? (
            <p className="text-sm text-white/40">O aluno ainda não registrou medidas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-white/40 text-xs">
                    <th className="pb-2 pr-3">Data</th>
                    {CAMPOS_MEDIDA.map(({ key, label }) => (
                      <th key={key} className="pb-2 pr-3">{label}</th>
                    ))}
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
