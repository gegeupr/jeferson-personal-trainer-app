"use server";

import { createSupabaseServer } from "@/utils/supabase-server";
import { supabaseAdmin } from "@/utils/supabaseAdmin";
import { Resend } from "resend";

export type AlterarChavePixResult =
  | { ok: true }
  | { ok: false; error: string };

export async function alterarChavePix(
  tipo: string,
  chave: string
): Promise<AlterarChavePixResult> {
  // 1. Validar sessão
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  // 2. Buscar chave anterior (para comparar e incluir no e-mail)
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("chave_pix, tipo_chave_pix, nome_completo")
    .eq("id", user.id)
    .maybeSingle();

  const chaveAnterior = profile?.chave_pix ?? null;
  const novaChave = chave.trim() || null;

  // 3. Atualizar no banco
  const { error: updErr } = await supabaseAdmin
    .from("profiles")
    .update({
      chave_pix: novaChave,
      tipo_chave_pix: tipo || null,
    })
    .eq("id", user.id);

  if (updErr) return { ok: false, error: "Erro ao salvar. Tente novamente." };

  // 4. Enviar e-mail de alerta se a chave mudou
  const chaveAlterada = novaChave !== chaveAnterior;
  if (chaveAlterada && user.email) {
    try {
      const resendKey = process.env.RESEND_API_KEY;
      if (resendKey) {
        const resend = new Resend(resendKey);
        const agora = new Date().toLocaleString("pt-BR", {
          timeZone: "America/Sao_Paulo",
          dateStyle: "short",
          timeStyle: "short",
        });
        const nome = profile?.nome_completo || "Professor";

        await resend.emails.send({
          from: "Motion <noreply@motionpersonal.com.br>",
          to: user.email,
          subject: "⚠️ Sua chave Pix foi alterada — Motion",
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0a0a0a;color:#fff;padding:32px;border-radius:12px">
              <h2 style="margin:0 0 8px">⚠️ Chave Pix alterada</h2>
              <p style="color:#aaa;margin:0 0 24px">Olá, ${nome}.</p>
              <p>Sua chave Pix foi alterada em <strong>${agora}</strong>.</p>
              ${chaveAnterior ? `<p style="color:#aaa">Chave anterior: <code style="background:#222;padding:2px 6px;border-radius:4px">${chaveAnterior}</code></p>` : ""}
              <p>Nova chave: <code style="background:#222;padding:2px 6px;border-radius:4px">${novaChave ?? "removida"}</code></p>
              <hr style="border-color:#333;margin:24px 0"/>
              <p style="color:#f87171;font-weight:600">Se não foi você que fez essa alteração, troque sua senha imediatamente:</p>
              <a href="${process.env.NEXT_PUBLIC_SITE_URL}/login" style="display:inline-block;margin-top:12px;background:#fff;color:#000;padding:10px 20px;border-radius:8px;font-weight:700;text-decoration:none">
                Acessar minha conta
              </a>
              <p style="color:#555;font-size:12px;margin-top:24px">Motion · Sistema para Personal Trainers</p>
            </div>
          `,
        });
      }
    } catch {
      // e-mail é best-effort — não bloqueia o save
    }
  }

  return { ok: true };
}
