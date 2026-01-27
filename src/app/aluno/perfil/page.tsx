"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/utils/supabase-browser";

type Profile = {
  id: string;
  role: "aluno" | "professor" | null;
  nome_completo: string | null;
  telefone: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio?: string | null;
  instagram?: string | null;
};

function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}

function publicUrlFrom(bucket: "avatars" | "covers", path: string) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

async function uploadToBucket(params: {
  bucket: "avatars" | "covers";
  uid: string;
  file: File;
  filename: string; // ex: "avatar.png"
}) {
  const { bucket, uid, file, filename } = params;

  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const safeExt = ["png", "jpg", "jpeg", "webp"].includes(ext) ? ext : "png";

  const path = `${uid}/${filename.replace(".png", `.${safeExt}`)}`;

  // upsert: true (substitui)
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
    contentType: file.type || `image/${safeExt}`,
  });

  if (error) throw error;

  return publicUrlFrom(bucket, path);
}

export default function AlunoPerfilPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [bio, setBio] = useState("");
  const [instagram, setInstagram] = useState("");

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const initials = useMemo(() => {
    const n = (nome || "").trim();
    return (n ? n[0] : "M").toUpperCase();
  }, [nome]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setErr(null);

      const { data: auth, error: authError } = await supabase.auth.getUser();
      const user = auth?.user;

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, role, nome_completo, telefone, avatar_url, cover_url, bio, instagram")
        .eq("id", user.id)
        .single();

      if (error || !data) {
        setErr("Não foi possível carregar seu perfil.");
        setLoading(false);
        return;
      }

      // Guard: só aluno
      if ((data.role || "").toLowerCase() !== "aluno") {
        router.replace("/dashboard");
        return;
      }

      if (!mounted) return;

      setProfile(data as Profile);

      setNome(data.nome_completo || "");
      setTelefone(data.telefone || "");
      setBio((data.bio as any) || "");
      setInstagram((data.instagram as any) || "");

      setAvatarUrl(data.avatar_url || null);
      setCoverUrl(data.cover_url || null);

      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  async function handlePickAvatar(file?: File) {
    if (!file) return;
    setErr(null);
    setMsg(null);

    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) return router.replace("/login");

      setSaving(true);

      const url = await uploadToBucket({
        bucket: "avatars",
        uid,
        file,
        filename: "avatar.png",
      });

      setAvatarUrl(url);

      // salva no profiles
      const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", uid);
      if (error) throw error;

      setMsg("Avatar atualizado com sucesso.");
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Erro ao enviar avatar.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePickCover(file?: File) {
    if (!file) return;
    setErr(null);
    setMsg(null);

    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) return router.replace("/login");

      setSaving(true);

      const url = await uploadToBucket({
        bucket: "covers",
        uid,
        file,
        filename: "cover.png",
      });

      setCoverUrl(url);

      const { error } = await supabase.from("profiles").update({ cover_url: url }).eq("id", uid);
      if (error) throw error;

      setMsg("Capa atualizada com sucesso.");
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Erro ao enviar capa.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    setErr(null);
    setMsg(null);

    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) return router.replace("/login");

      setSaving(true);

      const payload: Partial<Profile> = {
        nome_completo: nome.trim() || null,
        telefone: onlyDigits(telefone) || null,
        bio: bio.trim() || null,
        instagram: instagram.trim() || null,
      };

      const { error } = await supabase.from("profiles").update(payload).eq("id", uid);
      if (error) throw error;

      setMsg("Perfil salvo.");
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Erro ao salvar perfil.");
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

  if (err && !profile) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
        <div className="max-w-xl w-full rounded-3xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-xl font-semibold text-red-200">Erro</h1>
          <p className="mt-2 text-white/70">{err}</p>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => location.reload()}
              className="rounded-2xl bg-lime-400 px-4 py-2 font-bold text-black hover:bg-lime-300 transition"
            >
              Recarregar
            </button>
            <Link
              href="/aluno/dashboard"
              className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-white/80 hover:bg-white/10 transition"
            >
              Voltar
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* TOP BAR */}
      <div className="sticky top-0 z-50 border-b border-white/10 bg-black/60 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <Link
            href="/aluno/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
          >
            ← Voltar ao Dashboard
          </Link>

          <div className="text-sm text-white/70">Meu perfil (Aluno)</div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* HERO */}
        <div className="rounded-3xl border border-white/10 bg-white/5 overflow-hidden shadow-2xl">
          <div className="relative h-52 w-full bg-black/40">
            {coverUrl ? (
              <Image src={coverUrl} alt="Capa" fill className="object-cover opacity-90" priority />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/40 to-black/90" />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/40 to-black/90" />

            <div className="absolute left-6 bottom-[-30px] flex items-end gap-3">
              <div className="relative h-20 w-20 rounded-2xl overflow-hidden border border-white/10 bg-black/40">
                {avatarUrl ? (
                  <Image src={avatarUrl} alt="Avatar" fill className="object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-lime-300 font-extrabold text-2xl">
                    {initials}
                  </div>
                )}
              </div>

              <div className="pb-2">
                <p className="text-xs text-white/60">Seu perfil</p>
                <p className="text-lg font-bold">
                  <span className="text-lime-300">{nome || "Aluno"}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="pt-12 px-6 pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="text-sm text-white/60">
              Atualize seu avatar/capa e suas informações. Seu professor pode ver esses dados na gestão.
            </div>

            <div className="flex gap-2">
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handlePickCover(e.target.files?.[0])}
              />
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handlePickAvatar(e.target.files?.[0])}
              />

              <button
                disabled={saving}
                onClick={() => coverInputRef.current?.click()}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 disabled:opacity-50"
              >
                Trocar capa
              </button>

              <button
                disabled={saving}
                onClick={() => avatarInputRef.current?.click()}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 disabled:opacity-50"
              >
                Trocar avatar
              </button>
            </div>
          </div>
        </div>

        {/* FORM */}
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-bold">Dados</h2>

          {err ? <p className="mt-3 text-sm text-red-200">{err}</p> : null}
          {msg ? <p className="mt-3 text-sm text-lime-200">{msg}</p> : null}

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-white/60">Nome completo</label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="mt-2 w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-white outline-none focus:border-lime-400/40"
                placeholder="Seu nome"
              />
            </div>

            <div>
              <label className="text-xs text-white/60">Telefone (WhatsApp)</label>
              <input
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                className="mt-2 w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-white outline-none focus:border-lime-400/40"
                placeholder="Ex.: 42988311053"
              />
              <p className="mt-1 text-xs text-white/40">Salvamos apenas números. Sem espaços/traços.</p>
            </div>

            <div className="md:col-span-2">
              <label className="text-xs text-white/60">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="mt-2 w-full min-h-[110px] rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-white outline-none focus:border-lime-400/40"
                placeholder="Fale um pouco sobre você, sua rotina, seus objetivos…"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs text-white/60">Instagram (opcional)</label>
              <input
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                className="mt-2 w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-white outline-none focus:border-lime-400/40"
                placeholder="@seuinsta"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-2xl bg-lime-400 px-5 py-3 font-bold text-black hover:bg-lime-300 disabled:opacity-50"
            >
              {saving ? "Salvando…" : "Salvar alterações"}
            </button>

            <Link
              href="/aluno/dashboard"
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-white/80 hover:bg-white/10"
            >
              Cancelar
            </Link>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-white/40">Motion — treino inteligente, gestão simples.</div>
      </div>
    </main>
  );
}