"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/utils/supabase-browser";

type Post = {
  id: string;
  professor_id: string;
  aluno_id: string;
  kind: "depoimento" | "foto";
  content: string | null;
  rating: number | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

type Media = {
  id: string;
  post_id: string;
  storage_path: string;
  mime: string | null;
  created_at: string;
};

type ProfileMini = {
  id: string;
  nome_completo: string | null;
  avatar_url: string | null;
};

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { dateStyle: "medium" });
  } catch {
    return "";
  }
}

function stars(n: number) {
  const v = Math.max(0, Math.min(5, n));
  return "★★★★★".slice(0, v) + "☆☆☆☆☆".slice(0, 5 - v);
}

// ✅ seus helpers exatamente como você pediu
async function createPost(params: {
  professorId: string;
  kind: "depoimento" | "foto";
  content?: string;
  rating?: number;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) throw new Error("Faça login para postar.");

  const { data, error } = await supabase
    .from("community_posts")
    .insert({
      professor_id: params.professorId,
      aluno_id: user.id,
      kind: params.kind,
      content: params.content ?? null,
      rating: params.rating ?? null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

async function uploadCommunityPhoto(postId: string, file: File) {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) throw new Error("Sem sessão.");

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const safe = `${Date.now()}.${ext}`;
  const path = `${user.id}/${postId}/${safe}`;

  const { error } = await supabase.storage.from("community").upload(path, file, {
    upsert: false,
    contentType: file.type || "image/jpeg",
    cacheControl: "3600",
  });
  if (error) throw error;

  const { error: insErr } = await supabase.from("community_media").insert({
    post_id: postId,
    storage_path: path,
    mime: file.type || null,
  });
  if (insErr) throw insErr;

  return path;
}

// ✅ se o bucket community for PRIVADO, você precisa de URL assinada
async function getSignedUrl(path: string) {
  const { data, error } = await supabase.storage.from("community").createSignedUrl(path, 60 * 30);
  if (error) throw error;
  return data.signedUrl;
}

export default function CommunitySection({ professorId, professorSlug }: { professorId: string; professorSlug: string }) {
  const [me, setMe] = useState<{ id: string } | null>(null);

  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [mediaMap, setMediaMap] = useState<Record<string, Media[]>>({});
  const [alunosMap, setAlunosMap] = useState<Record<string, ProfileMini>>({});
  const [signedMap, setSignedMap] = useState<Record<string, string>>({});

  // form
  const [kind, setKind] = useState<"depoimento" | "foto">("depoimento");
  const [content, setContent] = useState("");
  const [rating, setRating] = useState<number>(5);
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);

  const [msgOk, setMsgOk] = useState<string | null>(null);
  const [msgErr, setMsgErr] = useState<string | null>(null);

  const canPost = useMemo(() => !!me?.id, [me]);

  async function load() {
    setLoading(true);
    setMsgErr(null);

    const { data: auth } = await supabase.auth.getUser();
    setMe(auth?.user ? { id: auth.user.id } : null);

    // 1) Posts aprovados (público)
    const { data: pData, error: pErr } = await supabase
      .from("community_posts")
      .select("id, professor_id, aluno_id, kind, content, rating, status, created_at")
      .eq("professor_id", professorId)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(30);

    if (pErr) {
      setMsgErr(pErr.message);
      setLoading(false);
      return;
    }

    const rows = (pData || []) as Post[];
    setPosts(rows);

    // 2) Buscar mídia dos posts
    const ids = rows.map((r) => r.id);
    if (ids.length) {
      const { data: mData, error: mErr } = await supabase
        .from("community_media")
        .select("id, post_id, storage_path, mime, created_at")
        .in("post_id", ids)
        .order("created_at", { ascending: true });

      if (!mErr && mData) {
        const map: Record<string, Media[]> = {};
        (mData as Media[]).forEach((m) => {
          map[m.post_id] = map[m.post_id] || [];
          map[m.post_id].push(m);
        });
        setMediaMap(map);

        // 3) URL assinada para cada arquivo (bucket privado)
        const allPaths = (mData as Media[]).map((m) => m.storage_path);
        const signed: Record<string, string> = {};
        for (const path of allPaths) {
          try {
            signed[path] = await getSignedUrl(path);
          } catch {
            // ignora
          }
        }
        setSignedMap(signed);
      }
    } else {
      setMediaMap({});
      setSignedMap({});
    }

    // 4) Buscar mini perfil dos alunos (nome/avatar) — se sua RLS permitir ler approved via public já ok
    const alunoIds = Array.from(new Set(rows.map((r) => r.aluno_id)));
    if (alunoIds.length) {
      const { data: aData } = await supabase
        .from("profiles")
        .select("id, nome_completo, avatar_url")
        .in("id", alunoIds);

      const aMap: Record<string, ProfileMini> = {};
      (aData || []).forEach((a: any) => (aMap[a.id] = a));
      setAlunosMap(aMap);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professorId]);

  async function submit() {
    setMsgOk(null);
    setMsgErr(null);

    if (!canPost) {
      setMsgErr("Faça login para postar.");
      return;
    }

    if (kind === "depoimento" && !content.trim()) {
      setMsgErr("Escreva um depoimento.");
      return;
    }

    if (kind === "foto" && !file) {
      setMsgErr("Selecione uma foto.");
      return;
    }

    setSending(true);
    try {
      const postId = await createPost({
        professorId,
        kind,
        content: kind === "depoimento" ? content.trim() : undefined,
        rating: kind === "depoimento" ? rating : undefined,
      });

      if (kind === "foto" && file) {
        await uploadCommunityPhoto(postId, file);
      }

      setMsgOk("Enviado! Agora aguarde a aprovação do professor.");
      setContent("");
      setFile(null);

      // opcional: recarregar lista
      await load();
    } catch (e: any) {
      setMsgErr(e?.message || "Erro ao enviar.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Comunidade</h2>
          <p className="mt-1 text-sm text-white/60">
            Depoimentos e fotos aprovados. Sem bagunça: tudo passa por moderação.
          </p>
        </div>

        {!canPost ? (
          <Link
            href={`/login?prof=${encodeURIComponent(professorSlug)}`}
            className="rounded-full bg-lime-400 px-5 py-2.5 text-sm font-semibold text-black hover:bg-lime-300 text-center"
          >
            Entrar para postar
          </Link>
        ) : null}
      </div>

      {/* FORM */}
      <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setKind("depoimento")}
            className={`rounded-full px-4 py-2 text-sm border transition ${
              kind === "depoimento"
                ? "border-lime-400/40 bg-lime-400/10 text-lime-200"
                : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            Depoimento
          </button>
          <button
            onClick={() => setKind("foto")}
            className={`rounded-full px-4 py-2 text-sm border transition ${
              kind === "foto"
                ? "border-lime-400/40 bg-lime-400/10 text-lime-200"
                : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            Foto pós-treino
          </button>
        </div>

        {msgErr ? (
          <div className="mt-3 rounded-2xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{msgErr}</div>
        ) : null}
        {msgOk ? (
          <div className="mt-3 rounded-2xl border border-lime-400/20 bg-lime-400/10 p-3 text-sm text-lime-200">{msgOk}</div>
        ) : null}

        {kind === "depoimento" ? (
          <div className="mt-4 grid gap-3">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Conte sua experiência com o professor (sem expor dados pessoais)…"
              className="w-full min-h-[110px] rounded-2xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-lime-400/40 focus:ring-2 focus:ring-lime-400/10 transition"
            />

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="text-sm text-white/60">Nota:</span>
                <select
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                  className="rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-sm outline-none"
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} — {stars(n)}
                    </option>
                  ))}
                </select>
              </div>

              <button
                disabled={!canPost || sending}
                onClick={submit}
                className="rounded-2xl bg-lime-400 px-5 py-2.5 text-sm font-bold text-black hover:bg-lime-300 disabled:opacity-60"
              >
                {sending ? "Enviando…" : "Enviar (vai para aprovação)"}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            <label className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm cursor-pointer hover:bg-white/10 transition">
              {file ? `Selecionado: ${file.name}` : "Selecionar foto"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setFile(f);
                  e.currentTarget.value = "";
                }}
              />
            </label>

            <button
              disabled={!canPost || !file || sending}
              onClick={submit}
              className="rounded-2xl bg-lime-400 px-5 py-2.5 text-sm font-bold text-black hover:bg-lime-300 disabled:opacity-60"
            >
              {sending ? "Enviando…" : "Enviar foto (vai para aprovação)"}
            </button>

            <p className="text-xs text-white/45">
              Dica: evite expor localização, documentos ou terceiros. O professor aprova antes de publicar.
            </p>
          </div>
        )}
      </div>

      {/* FEED */}
      <div className="mt-6">
        {loading ? (
          <div className="text-white/60">Carregando posts…</div>
        ) : posts.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-white/60">
            Ainda não há publicações aprovadas. Seja o primeiro a postar 👊
          </div>
        ) : (
          <div className="grid gap-3">
            {posts.map((p) => {
              const aluno = alunosMap[p.aluno_id];
              const medias = mediaMap[p.id] || [];
              return (
                <div key={p.id} className="rounded-3xl border border-white/10 bg-black/30 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative h-10 w-10 rounded-2xl overflow-hidden border border-white/10 bg-white/5 shrink-0">
                        {aluno?.avatar_url ? (
                          <Image src={aluno.avatar_url} alt="Avatar" fill className="object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-lime-300 font-bold">
                            {(aluno?.nome_completo || "A").slice(0, 1).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{aluno?.nome_completo || "Aluno"}</p>
                        <p className="text-xs text-white/50">{fmtDate(p.created_at)}</p>
                      </div>
                    </div>

                    {p.rating ? (
                      <div className="text-xs text-lime-200 border border-lime-400/20 bg-lime-400/10 rounded-full px-3 py-1">
                        {stars(p.rating)}
                      </div>
                    ) : null}
                  </div>

                  {p.content ? <p className="mt-3 text-sm text-white/80 whitespace-pre-wrap">{p.content}</p> : null}

                  {medias.length ? (
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {medias.slice(0, 6).map((m) => {
                        const url = signedMap[m.storage_path]; // bucket privado
                        if (!url) return null;
                        return (
                          <div key={m.id} className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-white/10">
                            <Image src={url} alt="Foto" fill className="object-cover" />
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}