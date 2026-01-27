import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { paths } = await req.json();

    if (!Array.isArray(paths) || paths.length === 0) {
      return NextResponse.json({ urls: {} });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // 🔥 AQUI ESTÁ A CHAVE CERTA
      { auth: { persistSession: false } }
    );

    const urls: Record<string, string | null> = {};

    for (const path of paths) {
      const { data, error } = await supabase.storage
        .from("community")
        .createSignedUrl(path, 60 * 60); // 1 hora

      urls[path] = error ? null : data?.signedUrl ?? null;
    }

    return NextResponse.json({ urls });
  } catch (err) {
    return NextResponse.json(
      { error: "Erro ao gerar URLs assinadas" },
      { status: 500 }
    );
  }
}