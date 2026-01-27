"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
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
};

type ProfileLite = {
  id: string;
  nome_completo: string | null;
  avatar_url: string | null;
};

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

async function signUrls(paths: string[]) {
  if (!paths.length) return {} as Record<string, string | null>;

  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;

  const res = await fetch("/api/community/sign", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ paths }),
  });

  const json = await res.json();
  return (json?.urls || {}) as Record<string, string | null>;
}

export default function ProfessorCommunityModerationPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profId, setProfId] = useState<string | null>(null);
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");

  const [posts, setPosts] = useState<Post[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [authors, setAuthors] = useState<Record<string, ProfileLite>>({});
  const [signed, setSigned] = useState<Record<string, string | null>>({});

  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const mediaByPost = useMemo(() => {
    const map: Record<string, Media[]> = {};
    for (const m of media) (map[m.post_id] ||= []).push(m);
    return map;
  }, [media]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);

      const { data: auth, error: authError } = await supabase.auth.getUser();
      const user = auth?.user;

      if (authError || !user) {
        router.push("/login");
        return;
      }

      const { data: prof, error: pErr } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", user.id)
        .single();

      if (pErr || !prof || (prof.role || "").toLowerCase() !== "professor") {
        router.push("/dashboard");
        return;
      }

      setProfId(prof.id);
      setLoading(false);
    })();
  }, [router]);

  async function load() {
    if (!profId) return;

    setErr(null);

    const { data: pData, error: pErr } = await supabase
      .from("community_posts")
      .select("id, professor_id, aluno_id, kind, content, rating, status, created_at")
      .eq("professor_id", profId)
      .eq("status", tab)
      .order("created_at", { ascending: false })
      .limit(60);

    if (pErr) {
      setErr(pErr.message);
      return;
    }

    const list = (pData || []) as Post[];
    setPosts(list);

    const postIds = list.map((p) => p.id);
    const alunoIds = Array.from(new Set(list.map((p) => p.aluno_id)));

    if (postIds.length) {
      const { data: mData } = await supabase
        .from("community_media")
        .select("id, post_id, storage_path")
        .in("post_id", postIds);

      const mList = (mData || []) as any as Media[];
      setMedia(mList);

      const paths = Array.from(new Set(mList.map((m) => m.storage_path)));
      const urls = await signUrls(paths);
      setSigned(urls);
    } else {
      setMedia([]);
      setSigned({});
    }

    if (alunoIds.length) {
      const { data: aData } = await supabase
        .from("profiles")
        .select("id, nome_completo, avatar_url")
        .in("id", alunoIds);

      const map: Record<string, ProfileLite> = {};
      (aData || []).forEach((a: any) => (map[a.id] = a));
      setAuthors(map);
    } else {
      setAuthors({});
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profId, tab]);

  async function setStatus(postId: string, status: "approved" | "rejected") {
    setBusyId(postId);
    setErr(null);

    try {
      const payload: any = { status };
      if (status === "approved") payload.approved_at = new Date().toISOString();

      const { error } = await supabase
        .from("community_posts")
        .update(payload)
        .eq("id", postId);

      if (error) throw error;

      await load();
    } catch (e: any) {
      setErr(e?.message || "Erro ao moderar.");
    } finally {
      setBusyId(null);
    }
  }

  async function removePost(postId: string) {
    if (!confirm("Excluir este post? (isso remove também mídias e likes)")) return;

    setBusyId(postId);
    setErr(null);

    try {
      const { error } = await supabase.from("community_posts").delete().eq("id", postId);
      if (error) throw error;
      await load();
    } catch (e: any) {
      setErr(e?.message || "Erro ao excluir.");
    } finally {
      setBusyId(null);
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
            href="/professor/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
          >
            ← Voltar ao Dashboard
          </Link>
          <div className="text-sm text-white/60">Moderação da Comunidade</div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 pb-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold">
              Comunidade <span className="text-lime-300">Motion</span>
            </h1>
            <p className="mt-2 text-sm text-white/60">
              Você controla o que aparece no seu perfil público: aprova, rejeita, exclui.
            </p>
          </div>

          <div className="flex gap-2">
            {(["pending", "approved", "rejected"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-full px-4 py-2 text-sm border transition ${
                  tab === t
                    ? "border-lime-400/40 bg-lime-400/10 text-lime-200"
                    : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                {t === "pending" ? "Pendentes" : t === "approved" ? "Aprovados" : "Rejeitados"}
              </button>
            ))}
          </div>
        </div>

        {err ? (
          <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">
            {err}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4">
          {posts.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-white/70">
              Nada por aqui.
            </div>
          ) : (
            posts.map((p) => {
              const a = authors[p.aluno_id];
              const pics = mediaByPost[p.id] || [];
              const busy = busyId === p.id;

              return (
                <div key={p.id} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative h-10 w-10 rounded-2xl overflow-hidden border border-white/10 bg-black/40 shrink-0">
                        {a?.avatar_url ? (
                          <Image src={a.avatar_url} alt="Avatar" fill className="object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-lime-300 font-extrabold">
                            {(a?.nome_completo || "A").slice(0, 1).toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="font-semibold truncate">{a?.nome_completo || "Aluno"}</p>
                        <p className="text-xs text-white/50">{formatDate(p.created_at)}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 justify-end">
                      {tab === "pending" ? (
                        <>
                          <button
                            disabled={busy}
                            onClick={() => setStatus(p.id, "approved")}
                            className="rounded-2xl bg-lime-400 px-4 py-2 text-sm font-bold text-black hover:bg-lime-300 disabled:opacity-60"
                          >
                            Aprovar
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => setStatus(p.id, "rejected")}
                            className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-60"
                          >
                            Rejeitar
                          </button>
                        </>
                      ) : tab === "rejected" ? (
                        <button
                          disabled={busy}
                          onClick={() => setStatus(p.id, "approved")}
                          className="rounded-2xl bg-lime-400 px-4 py-2 text-sm font-bold text-black hover:bg-lime-300 disabled:opacity-60"
                        >
                          Aprovar
                        </button>
                      ) : (
                        <button
                          disabled={busy}
                          onClick={() => setStatus(p.id, "rejected")}
                          className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-60"
                        >
                          Rejeitar
                        </button>
                      )}

                      <button
                        disabled={busy}
                        onClick={() => removePost(p.id)}
                        className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm text-red-200 hover:bg-red-400/15 disabled:opacity-60"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="text-xs text-white/50">
                      Tipo: <span className="text-white/80">{p.kind}</span>{" "}
                      {p.rating ? (
                        <>
                          • Nota: <span className="text-lime-300 font-semibold">{p.rating}/5</span>
                        </>
                      ) : null}
                    </div>

                    {p.content ? (
                      <p className="mt-2 text-white/80 text-sm leading-relaxed">
                        {p.content}
                      </p>
                    ) : null}

                    {pics.length ? (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {pics.slice(0, 4).map((m) => {
                          const url = signed[m.storage_path];
                          return (
                            <div key={m.id} className="relative h-52 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                              {url ? (
                                <Image src={url} alt="Foto" fill className="object-cover" />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center text-white/50 text-sm">
                                  imagem indisponível
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}