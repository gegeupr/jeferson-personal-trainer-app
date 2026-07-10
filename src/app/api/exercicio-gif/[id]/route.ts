import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/utils/supabase-server";
import { supabaseAdmin } from "@/utils/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Não autorizado", { status: 401 });

  const { data: gif, error } = await supabaseAdmin
    .from("exercicio_gifs")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  if (error || !gif) return new NextResponse("Não encontrado", { status: 404 });

  const { data: fileBlob, error: downloadErr } = await supabaseAdmin.storage
    .from("exercicio-gifs")
    .download(gif.storage_path);

  if (downloadErr || !fileBlob) {
    return new NextResponse("Erro ao carregar vídeo", { status: 500 });
  }

  const buffer = Buffer.from(await fileBlob.arrayBuffer());
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
