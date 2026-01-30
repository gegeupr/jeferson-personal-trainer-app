// src/utils/storage.ts
"use client";

import { supabase } from "@/utils/supabase-browser";

/**
 * Helpers
 */
function getExt(file: File, fallback: string) {
  const name = file?.name || "";
  const ext = name.includes(".") ? name.split(".").pop()?.toLowerCase() : "";
  return ext || fallback;
}

function safePublicUrl(bucket: string, path: string) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  if (!data?.publicUrl) {
    throw new Error("Não consegui gerar a URL pública do arquivo.");
  }
  return data.publicUrl;
}

function isImage(file: File) {
  return file.type?.startsWith("image/");
}

/**
 * Upload de avatar (professor ou aluno)
 * Bucket: avatars (público)
 *
 * IMPORTANTE (pra bater com as policies):
 * Path: {userId}/avatar_{timestamp}.{ext}
 *
 * Por que assim?
 * - evita cache (URL muda sempre)
 * - não sobrescreve o mesmo arquivo
 */
export async function uploadAvatar(file: File, userId: string) {
  if (!file) throw new Error("Arquivo inválido.");
  if (!userId) throw new Error("userId inválido.");
  if (!isImage(file)) throw new Error("Envie um arquivo de imagem.");

  const ext = getExt(file, "png");

  // ✅ PRIMEIRO NÍVEL = userId (pra policy liberar)
  const path = `${userId}/avatar_${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from("avatars").upload(path, file, {
    upsert: false,
    contentType: file.type,
    cacheControl: "0",
  });

  if (error) throw error;

  return safePublicUrl("avatars", path);
}

/**
 * Upload de capa do perfil público do professor
 * Bucket: covers (público)
 *
 * Path: {userId}/cover_{timestamp}.{ext}
 */
export async function uploadCover(file: File, userId: string) {
  if (!file) throw new Error("Arquivo inválido.");
  if (!userId) throw new Error("userId inválido.");
  if (!isImage(file)) throw new Error("Envie um arquivo de imagem.");

  const ext = getExt(file, "jpg");

  // ✅ PRIMEIRO NÍVEL = userId (pra policy liberar)
  const path = `${userId}/cover_${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from("covers").upload(path, file, {
    upsert: false,
    contentType: file.type,
    cacheControl: "0",
  });

  if (error) throw error;

  return safePublicUrl("covers", path);
}