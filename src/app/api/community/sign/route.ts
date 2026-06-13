import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // 1) Exige sessão autenticada (cookie do Supabase)
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { paths } = await req.json();
    if (!Array.isArray(paths) || paths.length === 0) {
      return NextResponse.json({ urls: {} });
    }

    // 2) Client admin só para validar ownership de forma explícita
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // paths que o usuário tem direito de ver:
    //  - é o professor dono do post, OU
    //  - é o autor (aluno) da mídia, OU
    //  - é aluno vinculado ao professor e o post está aprovado
    const { data: rows, error } = await admin
      .from("community_media")
      .select("storage_path, community_posts!inner(professor_id, aluno_id, status)")
      .in("storage_path", paths);
    if (error) {
      return NextResponse.json({ error: "Erro ao validar permissão" }, { status: 500 });
    }

    const { data: me } = await admin
      .from("profiles")
      .select("professor_id")
      .eq("id", user.id)
      .maybeSingle();
    const myProfessorId = me?.professor_id ?? null;

    type PostLite = {
      professor_id: string | null;
      aluno_id: string | null;
      status: string | null;
    };
    type MediaRow = {
      storage_path: string;
      community_posts: PostLite | PostLite[] | null;
    };

    const authorized = new Set(
      ((rows ?? []) as unknown as MediaRow[])
        .filter((r) => {
          const p = Array.isArray(r.community_posts)
            ? r.community_posts[0]
            : r.community_posts;
          if (!p) return false;
          if (p.professor_id === user.id) return true; // professor dono
          if (p.aluno_id === user.id) return true; // autor da mídia
          return (
            !!myProfessorId &&
            p.professor_id === myProfessorId &&
            p.status === "approved"
          );
        })
        .map((r) => r.storage_path)
    );

    // 3) Assina só os autorizados; o resto retorna null
    const urls: Record<string, string | null> = {};
    for (const path of paths) {
      if (!authorized.has(path)) {
        urls[path] = null;
        continue;
      }
      const { data, error: signErr } = await admin.storage
        .from("community")
        .createSignedUrl(path, 60 * 60);
      urls[path] = signErr ? null : data?.signedUrl ?? null;
    }

    return NextResponse.json({ urls });
  } catch {
    return NextResponse.json(
      { error: "Erro ao gerar URLs assinadas" },
      { status: 500 }
    );
  }
}
