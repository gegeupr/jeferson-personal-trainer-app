// src/utils/storage.ts
import { supabase } from "@/utils/supabase-browser";

/**
 * Upload de avatar (professor ou aluno)
 * Bucket: avatars (público)
 * Path: userId/avatar.ext
 */
export async function uploadAvatar(file: File, userId: string) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${userId}/avatar.${ext}`;

  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, {
      upsert: true,
      contentType: file.type,
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from("avatars")
    .getPublicUrl(path);

  return data.publicUrl;
}

/**
 * Upload de capa do perfil público do professor
 * Bucket: covers (público)
 * Path: userId/cover.ext
 */
export async function uploadCover(file: File, userId: string) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/cover.${ext}`;

  const { error } = await supabase.storage
    .from("covers")
    .upload(path, file, {
      upsert: true,
      contentType: file.type,
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from("covers")
    .getPublicUrl(path);

  return data.publicUrl;
}
