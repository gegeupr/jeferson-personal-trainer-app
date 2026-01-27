"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase-browser";
import { uploadAvatar, uploadCover } from "@/utils/storage";

type Profile = {
  id: string;
  role: "aluno" | "professor" | null;
  slug: string | null;

  nome_completo: string | null;
  bio: string | null;
  cidade: string | null;
  instagram: string | null;
  especialidades: string[] | null;

  avatar_url: string | null;
  cover_url: string | null;

  pagamento: any;
};

function normalizeInstagram(input: string) {
  return input.trim().replace(/^@+/, "").replace(/\s+/g, "");
}

function uniqueNonEmpty(arr: string[]) {
  const set = new Set<string>();
  for (const a of arr) {
    const v = a.trim();
    if (v) set.add(v);
  }
  return Array.from(set);
}

export default function ProfessorPerfilPublicoPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Form fields
  const [nome, setNome] = useState("");
  const [bio, setBio] = useState("");
  const [cidade, setCidade] = useState("");
  const [instagram, setInstagram] = useState("");
  const [especialidades, setEspecialidades] = useState<string[]>([]);
  const [novaEspecialidade, setNovaEspecialidade] = useState("");

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const publicLink = useMemo(() => {
    if (!profile?.slug) return null;
    if (typeof window === "undefined") return null;
    return `${window.location.origin}/p/${profile.slug}`;
  }, [profile?.slug]);

  async function load() {
    setLoading(true);
    setToast(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;

    if (!user) {
      router.push("/login");
      return;
    }

    setUserId(user.id);

    const { data: p, error } = await supabase
      .from("profiles")
      .select(
        "id, role, slug, nome_completo, bio, cidade, instagram, especialidades, avatar_url, cover_url, pagamento"
      )
      .eq("id", user.id)
      .maybeSingle();

    if (error || !p) {
      setToast({ type: "err", msg: "Não foi possível carregar seu perfil." });
      setLoading(false);
      return;
    }

    if (p.role !== "professor") {
      setToast({ type: "err", msg: "Acesso negado. Esta área é apenas para professores." });
      setLoading(false);
      return;
    }

    const prof = p as Profile;
    setProfile(prof);

    setNome(prof.nome_completo ?? "");
    setBio(prof.bio ?? "");
    setCidade(prof.cidade ?? "");
    setInstagram(prof.instagram ?? "");
    setEspecialidades(prof.especialidades ?? []);

    setAvatarUrl(prof.avatar_url ?? null);
    setCoverUrl(prof.cover_url ?? null);

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function showOk(msg: string) {
    setToast({ type: "ok", msg });
    setTimeout(() => setToast(null), 2500);
  }

  function showErr(msg: string) {
    setToast({ type: "err", msg });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleSave() {
    if (!userId) return;
    setSaving(true);
    setToast(null);

    try {
      const payload = {
        nome_completo: nome.trim() || null,
        bio: bio.trim() || null,
        cidade: cidade.trim() || null,
        instagram: normalizeInstagram(instagram) || null,
        especialidades: uniqueNonEmpty(especialidades),
      };

      const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
      if (error) throw error;

      showOk("Perfil atualizado com sucesso.");
      await load();
    } catch (e: any) {
      showErr(e?.message || "Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function onPickAvatar(file?: File) {
    if (!file || !userId) return;
    setUploadingAvatar(true);
    setToast(null);

    try {
      // Preview instantâneo
      const localPreview = URL.createObjectURL(file);
      setAvatarUrl(localPreview);

      const url = await uploadAvatar(file, userId);

      const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
      if (error) throw error;

      setAvatarUrl(url);
      showOk("Avatar atualizado.");
    } catch (e: any) {
      showErr(e?.message || "Erro ao enviar avatar.");
      // volta pro valor do banco
      setAvatarUrl(profile?.avatar_url ?? null);
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function onPickCover(file?: File) {
    if (!file || !userId) return;
    setUploadingCover(true);
    setToast(null);

    try {
      const localPreview = URL.createObjectURL(file);
      setCoverUrl(localPreview);

      const url = await uploadCover(file, userId);

      const { error } = await supabase.from("profiles").update({ cover_url: url }).eq("id", userId);
      if (error) throw error;

      setCoverUrl(url);
      showOk("Capa atualizada.");
    } catch (e: any) {
      showErr(e?.message || "Erro ao enviar capa.");
      setCoverUrl(profile?.cover_url ?? null);
    } finally {
      setUploadingCover(false);
    }
  }

  function addEspecialidade() {
    const raw = novaEspecialidade.trim();
    if (!raw) return;

    // permite colar "A, B, C"
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
    const merged = uniqueNonEmpty([...especialidades, ...parts]);
    setEspecialidades(merged);
    setNovaEspecialidade("");
  }

  function removeEspecialidade(tag: string) {
    setEspecialidades(especialidades.filter((t) => t !== tag));
  }

  async function copyPublicLink() {
    if (!publicLink) return;
    try {
      await navigator.clipboard.writeText(publicLink);
      showOk("Link copiado!");
    } catch {
      showErr("Não consegui copiar automaticamente. Copie manualmente.");
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-white/70">Carregando perfil…</div>
      </main>
    );
  }

  if (!profile || profile.role !== "professor") {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold">Acesso negado</h1>
          <p className="mt-2 text-white/60">Esta página é exclusiva para professores.</p>
          <Link
            href="/dashboard"
            className="inline-block mt-6 rounded-full bg-lime-400 px-6 py-3 text-sm font-semibold text-black hover:bg-lime-300"
          >
            Ir para o Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Capa */}
      <section className="relative">
        <div className="relative h-[260px] w-full">
          {coverUrl ? (
            <Image src={coverUrl} alt="Capa" fill className="object-cover opacity-85" priority />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(163,230,53,0.18),rgba(0,0,0,0)_55%)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/45 to-black" />
        </div>

        <div className="mx-auto max-w-6xl px-5 -mt-16 pb-10">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center">
              {/* Avatar */}
              <div className="flex gap-4 items-center">
                <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                  {avatarUrl ? (
                    <Image src={avatarUrl} alt="Avatar" fill className="object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-lime-300 font-bold">
                      {(nome || "M").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm text-white/70">Foto (avatar)</label>
                  <label className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10 cursor-pointer">
                    {uploadingAvatar ? "Enviando..." : "Trocar avatar"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingAvatar}
                      onChange={(e) => onPickAvatar(e.target.files?.[0])}
                    />
                  </label>
                </div>
              </div>

              <div className="flex-1">
                <h1 className="text-2xl sm:text-3xl font-bold">Perfil Público do Professor</h1>
                <p className="mt-1 text-white/60 text-sm">
                  Personalize sua página e compartilhe o link com seus alunos.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href="/professor/dashboard"
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10"
                  >
                    ← Voltar ao Dashboard
                  </Link>

                  <label className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10 cursor-pointer">
                    {uploadingCover ? "Enviando..." : "Trocar capa"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingCover}
                      onChange={(e) => onPickCover(e.target.files?.[0])}
                    />
                  </label>

                  {profile.slug ? (
                    <>
                      <button
                        onClick={copyPublicLink}
                        className="rounded-full bg-lime-400 px-4 py-2 text-sm font-semibold text-black hover:bg-lime-300"
                      >
                        Copiar link público
                      </button>
                      <Link
                        href={`/p/${profile.slug}`}
                        target="_blank"
                        className="rounded-full border border-lime-400/30 bg-lime-400/10 px-4 py-2 text-sm font-semibold text-lime-200 hover:bg-lime-400/15"
                      >
                        Abrir página pública ↗
                      </Link>
                    </>
                  ) : (
                    <span className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-200">
                      Seu slug será gerado automaticamente após salvar o nome.
                    </span>
                  )}
                </div>
              </div>
            </div>

            {toast && (
              <div
                className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${
                  toast.type === "ok"
                    ? "border-lime-400/20 bg-lime-400/10 text-lime-200"
                    : "border-red-500/20 bg-red-500/10 text-red-200"
                }`}
              >
                {toast.msg}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Form */}
      <section className="mx-auto max-w-6xl px-5 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Editor */}
          <div className="lg:col-span-2 rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-bold">Informações do perfil</h2>
            <p className="text-sm text-white/60 mt-1">Esses dados aparecem na sua página pública.</p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="text-sm text-white/70">Nome completo</label>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-lime-400/40"
                  placeholder="Ex: Professor Jeferson"
                />
              </div>

              <div>
                <label className="text-sm text-white/70">Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="mt-2 w-full min-h-[120px] rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-lime-400/40"
                  placeholder="Escreva um resumo profissional (objetivo, método, resultados, diferencial)."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-white/70">Cidade</label>
                  <input
                    value={cidade}
                    onChange={(e) => setCidade(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-lime-400/40"
                    placeholder="Ex: Ponta Grossa - PR"
                  />
                </div>
                <div>
                  <label className="text-sm text-white/70">Instagram</label>
                  <input
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-lime-400/40"
                    placeholder="Ex: jeferson.personal"
                  />
                  <p className="mt-2 text-xs text-white/50">
                    Dica: pode digitar com @ que eu removo automaticamente ao salvar.
                  </p>
                </div>
              </div>

              <div>
                <label className="text-sm text-white/70">Especialidades</label>

                <div className="mt-2 flex gap-2">
                  <input
                    value={novaEspecialidade}
                    onChange={(e) => setNovaEspecialidade(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addEspecialidade();
                      }
                    }}
                    className="flex-1 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-lime-400/40"
                    placeholder="Ex: Hipertrofia, Emagrecimento, Funcional… (Enter para adicionar)"
                  />
                  <button
                    onClick={addEspecialidade}
                    className="rounded-2xl bg-lime-400 px-4 py-3 text-sm font-semibold text-black hover:bg-lime-300"
                    type="button"
                  >
                    Adicionar
                  </button>
                </div>

                {especialidades.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {especialidades.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => removeEspecialidade(t)}
                        className="group inline-flex items-center gap-2 rounded-full border border-lime-400/20 bg-lime-400/10 px-3 py-1 text-xs text-lime-200 hover:bg-lime-400/15"
                        title="Clique para remover"
                      >
                        {t}
                        <span className="text-lime-200/70 group-hover:text-lime-100">×</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-white/50">
                    Adicione tags para aparecerem como “chips” na sua página pública.
                  </p>
                )}
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-2xl bg-lime-400 px-6 py-3 text-sm font-semibold text-black hover:bg-lime-300 disabled:opacity-60"
                  type="button"
                >
                  {saving ? "Salvando..." : "Salvar alterações"}
                </button>

                {profile.slug ? (
                  <span className="text-xs text-white/50">
                    Seu link: <span className="text-lime-300">/p/{profile.slug}</span>
                  </span>
                ) : (
                  <span className="text-xs text-white/50">Salve para gerar seu link público.</span>
                )}
              </div>
            </div>
          </div>

          {/* COLUNA DIREITA */}
          <div className="space-y-6">
            {/* Card: Planos & Pagamentos (NOVO) */}
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-lg font-bold">Planos & Pagamentos</h2>
              <p className="text-sm text-white/60 mt-1">
                Configure seus 3 planos (30/90/180 dias) com link de pagamento e WhatsApp.
              </p>

              <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/70">
                O pagamento cai <span className="text-white">direto na sua conta</span>.
                <div className="mt-2 text-xs text-white/50">
                  O aluno paga, envia o comprovante e você ativa manualmente o acesso.
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2">
                <Link
                  href="/professor/planos"
                  className="inline-flex items-center justify-center rounded-2xl bg-lime-400 px-4 py-3 text-sm font-semibold text-black hover:bg-lime-300"
                >
                  Configurar meus planos →
                </Link>

                <Link
                  href="/aluno/planos"
                  target="_blank"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/80 hover:bg-white/10"
                >
                  Ver como aparece para o aluno ↗
                </Link>
              </div>
            </div>

            {/* Preview card (o seu) */}
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-lg font-bold">Prévia rápida</h2>
              <p className="text-sm text-white/60 mt-1">Como seu perfil vai aparecer para o aluno.</p>

              <div className="mt-5 rounded-2xl overflow-hidden border border-white/10 bg-black/40">
                <div className="relative h-28 w-full">
                  {coverUrl ? (
                    <Image src={coverUrl} alt="Capa" fill className="object-cover opacity-90" />
                  ) : (
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(163,230,53,0.18),rgba(0,0,0,0)_55%)]" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black" />
                </div>

                <div className="p-4 -mt-8">
                  <div className="flex items-end gap-3">
                    <div className="relative h-14 w-14 rounded-2xl overflow-hidden border border-white/10 bg-black/50">
                      {avatarUrl ? (
                        <Image src={avatarUrl} alt="Avatar" fill className="object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-lime-300 font-bold">
                          {(nome || "M").slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold">{nome || "Seu nome aparecerá aqui"}</div>
                      <div className="text-xs text-white/60">{cidade || "Sua cidade"} • Motion</div>
                    </div>
                  </div>

                  {bio ? (
                    <p className="mt-3 text-sm text-white/80 line-clamp-4">{bio}</p>
                  ) : (
                    <p className="mt-3 text-sm text-white/50">Escreva uma bio para aumentar conversão.</p>
                  )}

                  {especialidades.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {especialidades.slice(0, 6).map((t) => (
                        <span
                          key={t}
                          className="rounded-full border border-lime-400/20 bg-lime-400/10 px-3 py-1 text-xs text-lime-200"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-4">
                    {profile.slug ? (
                      <Link
                        href={`/p/${profile.slug}`}
                        target="_blank"
                        className="inline-flex w-full items-center justify-center rounded-full bg-lime-400 px-4 py-2 text-sm font-semibold text-black hover:bg-lime-300"
                      >
                        Ver página pública ↗
                      </Link>
                    ) : (
                      <div className="w-full text-center text-xs text-white/50">Salve para gerar a página pública.</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-5 text-xs text-white/50">
                Dica: use uma capa escura e nítida. Isso deixa seu Motion com cara de marca grande.
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}


