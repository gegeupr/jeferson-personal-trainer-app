"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase-browser";

type Profile = {
  id: string;
  role: string | null;
  nome_completo: string | null;
  email: string | null;
  telefone: string | null;
  bio: string | null;
  instagram: string | null;
  avatar_url: string | null;
  cover_url: string | null;
};

function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}

function clampUrl(v: string) {
  const s = (v || "").trim();
  return s.length ? s : "";
}

function storagePublicUrl(bucket: "avatars" | "covers", path: string) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

async function uploadImage(opts: {
  bucket: "avatars" | "covers";
  userId: string;
  file: File;
  fileName: string; // "avatar.png" | "cover.png"
}) {
  const { bucket, userId, file, fileName } = opts;
  const path = `${userId}/${fileName}`;

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
    contentType: file.type || "image/png",
    cacheControl: "3600",
  });

  if (error) throw error;

  return storagePublicUrl(bucket, path);
}

export default function AlunoMeuPerfilPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  // form
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [bio, setBio] = useState("");
  const [instagram, setInstagram] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  const initials = useMemo(() => {
    const base = (nome || profile?.nome_completo || "M").trim();
    return base.slice(0, 1).toUpperCase();
  }, [nome, profile?.nome_completo]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      const { data: auth, error: authError } = await supabase.auth.getUser();
      const user = auth?.user;

      if (authError || !user) {
        router.push("/login");
        return;
      }

      const { data, error: pErr } = await supabase
        .from("profiles")
        .select("id, role, nome_completo, email, telefone, bio, instagram, avatar_url, cover_url")
        .eq("id", user.id)
        .single();

      if (pErr || !data) {
        setError("Não foi possível carregar seu perfil.");
        setLoading(false);
        return;
      }

      if ((data.role || "").toLowerCase() !== "aluno") {
        router.push("/dashboard");
        return;
      }

      setUserId(user.id);
      setProfile(data as Profile);

      setNome(data.nome_completo || "");
      setTelefone(data.telefone || "");
      setBio(data.bio || "");
      setInstagram(data.instagram || "");
      setAvatarUrl(data.avatar_url || null);
      setCoverUrl(data.cover_url || null);

      setLoading(false);
    })();
  }, [router]);

  async function onPickAvatar(file: File) {
    if (!userId) return;
    setError(null);
    setOkMsg(null);

    try {
      const url = await uploadImage({
        bucket: "avatars",
        userId,
        file,
        fileName: "avatar.png",
      });
      setAvatarUrl(url);
      setOkMsg("Avatar enviado. Agora é só salvar.");
    } catch (e: any) {
      setError(e?.message || "Erro ao enviar avatar.");
    }
  }

  async function onPickCover(file: File) {
    if (!userId) return;
    setError(null);
    setOkMsg(null);

    try {
      const url = await uploadImage({
        bucket: "covers",
        userId,
        file,
        fileName: "cover.png",
      });
      setCoverUrl(url);
      setOkMsg("Capa enviada. Agora é só salvar.");
    } catch (e: any) {
      setError(e?.message || "Erro ao enviar capa.");
    }
  }

  async function onSave() {
    if (!userId) return;

    setSaving(true);
    setError(null);
    setOkMsg(null);

    try {
      const payload = {
        nome_completo: nome.trim() || null,
        telefone: onlyDigits(telefone) || null,
        bio: bio.trim() || null,
        instagram: clampUrl(instagram) || null,
        avatar_url: avatarUrl || null,
        cover_url: coverUrl || null,
      };

      const { error: uErr } = await supabase.from("profiles").update(payload).eq("id", userId);

      if (uErr) throw uErr;

      setOkMsg("Perfil atualizado com sucesso.");
    } catch (e: any) {
      setError(e?.message || "Erro ao salvar perfil.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-lime-300 text-lg">Carregando…</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* Top bar */}
      <div className="sticky top-0 z-50 border-b border-white/10 bg-black/60 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <Link
            href="/aluno/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
          >
            ← Voltar ao Dashboard
          </Link>

          <div className="text-sm text-white/60">Meu Perfil</div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 pb-16">
        {/* HERO CARD */}
        <div className="rounded-3xl border border-white/10 bg-white/5 overflow-hidden">
          {/* Cover */}
          <div className="relative h-48 sm:h-56 bg-black/40">
            {coverUrl ? (
              <Image src={coverUrl} alt="Capa" fill className="object-cover" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-black via-black to-lime-500/10" />
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

            <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4">
              {/* Avatar + name */}
              <div className="flex items-end gap-4 min-w-0">
                <div className="relative h-20 w-20 sm:h-24 sm:w-24 rounded-2xl overflow-hidden border border-white/10 bg-black/40">
                  {avatarUrl ? (
                    <Image src={avatarUrl} alt="Avatar" fill className="object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-lime-300 font-extrabold text-2xl">
                      {initials}
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <h1 className="text-2xl sm:text-3xl font-extrabold truncate">
                    {nome || profile?.nome_completo || "Seu nome"}
                  </h1>
                  <p className="text-white/60 text-sm truncate">{profile?.email || ""}</p>
                </div>
              </div>

              {/* actions */}
              <div className="flex flex-col sm:flex-row gap-2">
                <label className="cursor-pointer rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition">
                  Trocar capa
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onPickCover(f);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>

                <label className="cursor-pointer rounded-2xl bg-lime-500 px-4 py-2 text-sm font-semibold text-black hover:bg-lime-400 transition">
                  Trocar avatar
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onPickAvatar(f);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 sm:p-8">
            {error ? (
              <div className="mb-4 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">
                {error}
              </div>
            ) : null}

            {okMsg ? (
              <div className="mb-4 rounded-2xl border border-lime-400/20 bg-lime-400/10 p-4 text-lime-200">
                {okMsg}
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm text-white/60">Nome</label>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="mt-2 w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-lime-400/40 focus:ring-2 focus:ring-lime-400/10 transition"
                  placeholder="Seu nome completo"
                />
              </div>

              <div>
                <label className="text-sm text-white/60">Telefone (WhatsApp)</label>
                <input
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  className="mt-2 w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-lime-400/40 focus:ring-2 focus:ring-lime-400/10 transition"
                  placeholder="Ex: 42988311053"
                />
                <p className="mt-2 text-xs text-white/40">
                  Dica: deixe só números. Se faltar DDI, o app assume Brasil (55).
                </p>
              </div>

              <div className="md:col-span-2">
                <label className="text-sm text-white/60">Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="mt-2 w-full min-h-[120px] rounded-2xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-lime-400/40 focus:ring-2 focus:ring-lime-400/10 transition"
                  placeholder="Conte um pouco sobre você e seus objetivos…"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-sm text-white/60">Instagram (opcional)</label>
                <input
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  className="mt-2 w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-lime-400/40 focus:ring-2 focus:ring-lime-400/10 transition"
                  placeholder="Ex: @seuuser ou https://instagram.com/seuuser"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <button
                onClick={onSave}
                disabled={saving}
                className="rounded-2xl bg-lime-500 px-6 py-3 text-black font-extrabold hover:bg-lime-400 transition disabled:opacity-60"
              >
                {saving ? "Salvando…" : "Salvar Perfil"}
              </button>

              <p className="text-sm text-white/45">
                Seu professor consegue ver este perfil dentro da gestão.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}