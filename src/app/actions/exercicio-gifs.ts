"use server";

import { createSupabaseServer } from "@/utils/supabase-server";
import { supabaseAdmin } from "@/utils/supabaseAdmin";

export const GRUPOS_MUSCULARES_GIF = [
  "Costas",
  "Peito",
  "Funcional",
  "Ombro",
  "Pernas",
  "Mobilidade",
  "Bíceps",
  "Tríceps",
  "Glúteos",
  "Panturrilha",
  "Abdômen",
  "Cardio",
  "Não classificado",
] as const;

async function assertProfessor(): Promise<string | null> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "professor") return null;
  return user.id;
}

export type ExercicioGifItem = {
  id: string;
  nome_arquivo: string;
  grupo_muscular_amplo: string | null;
};

export type ListarGifsResult =
  | { ok: true; gifs: ExercicioGifItem[] }
  | { ok: false; error: string };

export async function listarGifs(
  busca: string,
  grupoMuscular: string
): Promise<ListarGifsResult> {
  const profId = await assertProfessor();
  if (!profId) return { ok: false, error: "Não autorizado." };

  let query = supabaseAdmin
    .from("exercicio_gifs")
    .select("id, nome_arquivo, grupo_muscular_amplo")
    .order("nome_arquivo")
    .limit(60);

  if (grupoMuscular) query = query.eq("grupo_muscular_amplo", grupoMuscular);
  if (busca.trim()) query = query.ilike("nome_arquivo", `%${busca.trim()}%`);

  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };
  return { ok: true, gifs: (data ?? []) as ExercicioGifItem[] };
}

export type AtribuirGifResult = { ok: true } | { ok: false; error: string };

export async function atribuirGifCatalogo(
  catalogoId: string,
  gifId: string | null
): Promise<AtribuirGifResult> {
  const profId = await assertProfessor();
  if (!profId) return { ok: false, error: "Não autorizado." };

  const { error } = await supabaseAdmin
    .from("exercicios_catalogo")
    .update({ gif_id: gifId })
    .eq("id", catalogoId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function atribuirGifCustom(
  exercicioId: string,
  gifId: string | null,
  profId: string
): Promise<AtribuirGifResult> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== profId) return { ok: false, error: "Não autorizado." };

  const { error } = await supabaseAdmin
    .from("exercicios")
    .update({ gif_id: gifId })
    .eq("id", exercicioId)
    .eq("professor_id", profId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
