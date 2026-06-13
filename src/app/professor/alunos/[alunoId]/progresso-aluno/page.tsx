"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/utils/supabase-browser";
import Link from "next/link";

interface ProgressoFoto {
  id: string;
  url: string;
  descricao: string | null;
  data_foto: string | null;
  created_at: string;
}

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

      setLoading(false);
    }
    fetchProgressPhotos();
  }, [router, alunoId]);

  const alunoNome = alunoProfile?.nome_completo || "Aluno";

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

        {fotos.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-8 text-center">
            <p className="text-white/40 text-sm">O aluno ainda não enviou fotos de progresso.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {fotos.map((foto) => (
              <div key={foto.id} className="rounded-2xl border border-white/8 bg-white/[0.03] overflow-hidden">
                <div className="relative w-full h-44 overflow-hidden">
                  <ProgressPhotoImg src={foto.url} alt={foto.descricao || "Foto de progresso"} />
                </div>
                <div className="px-3 py-2.5">
                  <p className="text-xs font-medium text-white/70">
                    {foto.data_foto ? formatDateBR(foto.data_foto) : formatDateBR(foto.created_at)}
                  </p>
                  {foto.descricao && (
                    <p className="text-xs text-white/40 mt-0.5 leading-relaxed">{foto.descricao}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
