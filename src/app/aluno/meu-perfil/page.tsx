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

function onlyDigits(v: string) { return (v || "").replace(/\D/g, ""); }
function clampUrl(v: string) { return (v || "").trim(); }

function storagePublicUrl(bucket: "avatars" | "covers", path: string) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

async function uploadImage(opts: { bucket: "avatars" | "covers"; userId: string; file: File; fileName: string }) {
  const { bucket, userId, file, fileName } = opts;
  const path = `${userId}/${fileName}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type || "image/png", cacheControl: "3600" });
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
      if (authError || !user) { router.push("/login"); return; }

      const { data, error: pErr } = await supabase
        .from("profiles")
        .select("id, role, nome_completo, email, telefone, bio, instagram, avatar_url, cover_url")
        .eq("id", user.id)
        .single();

      if (pErr || !data) { setError("Não foi possível carregar seu perfil."); setLoading(false); return; }
      if ((data.role || "").toLowerCase() !== "aluno") { router.push("/dashboard"); return; }

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
    setError(null); setOkMsg(null);
    try {
      const url = await uploadImage({ bucket: "avatars", userId, file, fileName: "avatar.png" });
      setAvatarUrl(url);
      setOkMsg("Avatar enviado. Agora é só salvar.");
    } catch (e: any) { setError(e?.message || "Erro ao enviar avatar."); }
  }

  async function onPickCover(file: File) {
    if (!userId) return;
    setError(null); setOkMsg(null);
    try {
      const url = await uploadImage({ bucket: "covers", userId, file, fileName: "cover.png" });
      setCoverUrl(url);
      setOkMsg("Capa enviada. Agora é só salvar.");
    } catch (e: any) { setError(e?.message || "Erro ao enviar capa."); }
  }

  async function onSave() {
    if (!userId) return;
    setSaving(true); setError(null); setOkMsg(null);
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
    } catch (e: any) { setError(e?.message || "Erro ao salvar perfil."); }
    finally { setSaving(false); }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-white/40 text-sm">Carregando…</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white px-4 py-8 pb-16">
      <div className="mx-auto max-w-3xl space-y-5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-white/40">
          <Link href="/aluno/dashboard" className="hover:text-white/70 transition-colors">Dashboard</Link>
          <span>/</span>
          <span className="text-white/60">Meu Perfil</span>
        </div>

        {/* Cover + Avatar */}
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] overflow-hidden">
          <div className="relative h-40 bg-black/40">
            {coverUrl ? (
              <Image src={coverUrl} alt="Capa" fill className="object-cover opacity-90" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

            <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between gap-3">
              <div className="flex items-end gap-3">
                <div className="relative h-16 w-16 rounded-xl overflow-hidden border border-white/10 bg-black/60 shrink-0">
                  {avatarUrl ? (
                    <Image src={avatarUrl} alt="Avatar" fill className="object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-white font-bold text-xl">{initials}</div>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-white">{nome || profile?.nome_completo || "Seu nome"}</p>
                  <p className="text-xs text-white/50">{profile?.email || ""}</p>
                </div>
              </div>

              <div className="flex gap-2 shrink-0">
                <label className="cursor-pointer rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 transition-colors">
                  Capa
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickCover(f); e.currentTarget.value = ""; }} />
                </label>
                <label className="cursor-pointer rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-white/90 transition-colors">
                  Avatar
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickAvatar(f); e.currentTarget.value = ""; }} />
                </label>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="p-6 space-y-4">
            {error && (
              <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</div>
            )}
            {okMsg && (
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">{okMsg}</div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm text-white/60">Nome</label>
                <input value={nome} onChange={(e) => setNome(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-white/25 transition-colors"
                  placeholder="Seu nome completo" />
              </div>

              <div>
                <label className="text-sm text-white/60">Telefone (WhatsApp)</label>
                <input value={telefone} onChange={(e) => setTelefone(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-white/25 transition-colors"
                  placeholder="Ex: 42988311053" />
              </div>

              <div className="md:col-span-2">
                <label className="text-sm text-white/60">Bio</label>
                <textarea value={bio} onChange={(e) => setBio(e.target.value)}
                  className="mt-2 w-full min-h-[100px] rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-white/25 transition-colors resize-none"
                  placeholder="Seus objetivos, histórico, observações…" />
              </div>

              <div className="md:col-span-2">
                <label className="text-sm text-white/60">Instagram (opcional)</label>
                <input value={instagram} onChange={(e) => setInstagram(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-white/25 transition-colors"
                  placeholder="@seuuser" />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button onClick={onSave} disabled={saving}
                className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-60 transition-colors">
                {saving ? "Salvando…" : "Salvar perfil"}
              </button>
              <p className="text-xs text-white/40">Seu professor pode ver este perfil.</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
