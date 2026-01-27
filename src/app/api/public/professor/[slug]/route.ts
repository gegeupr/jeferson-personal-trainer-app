import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  try {
    const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceKey = mustEnv("SUPABASE_SERVICE_ROLE_KEY");

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { slug: rawSlug } = await ctx.params;
    const slug = (rawSlug || "").trim().toLowerCase();

    if (!slug) {
      return NextResponse.json({ error: "Missing slug" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select(
        "id, slug, nome_completo, bio, avatar_url, cover_url, especialidades, cidade, instagram, pagamento, role"
      )
      .eq("slug", slug)
      .eq("role", "professor")
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: error.message, code: "SUPABASE_ERROR" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Professor not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Retorno apenas público
    return NextResponse.json(
      {
        id: data.id,
        slug: data.slug,
        nome_completo: data.nome_completo,
        bio: data.bio,
        avatar_url: data.avatar_url,
        cover_url: data.cover_url,
        especialidades: data.especialidades,
        cidade: data.cidade,
        instagram: data.instagram,
        pagamento: data.pagamento,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error", code: "UNEXPECTED" },
      { status: 500 }
    );
  }
}



