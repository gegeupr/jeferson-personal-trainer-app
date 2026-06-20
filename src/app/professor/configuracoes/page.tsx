"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase-browser";
import { alterarChavePix } from "@/app/actions/configuracoes";

type TipoChave = "cpf" | "email" | "telefone" | "aleatoria";

const TIPOS: { value: TipoChave; label: string }[] = [
  { value: "cpf", label: "CPF" },
  { value: "email", label: "E-mail" },
  { value: "telefone", label: "Telefone" },
  { value: "aleatoria", label: "Chave aleatória" },
];

export default function ConfiguracoesPage() {
  // ── Pix ──────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tipo, setTipo] = useState<TipoChave | "">("");
  const [chave, setChave] = useState("");
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  // ── 2FA ──────────────────────────────────────────────
  const [mfaLoading, setMfaLoading] = useState(true);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [enrollData, setEnrollData] = useState<{
    factorId: string;
    qrCode: string;
    secret: string;
  } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaSaving, setMfaSaving] = useState(false);
  const [mfaToast, setMfaToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const [showDisable, setShowDisable] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) return;

      const [pixResult] = await Promise.all([
        supabase.from("profiles").select("chave_pix, tipo_chave_pix").eq("id", user.id).maybeSingle(),
        carregarMfa(),
      ]);

      setChave(pixResult.data?.chave_pix ?? "");
      setTipo((pixResult.data?.tipo_chave_pix as TipoChave) ?? "");
      setLoading(false);
    })();
  }, []);

  async function carregarMfa() {
    const { data } = await supabase.auth.mfa.listFactors();
    const factor = data?.totp?.find((f) => f.status === "verified") ?? null;
    setMfaFactorId(factor?.id ?? null);
    setMfaLoading(false);
  }

  // ── Pix save ─────────────────────────────────────────
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setToast(null);
    const result = await alterarChavePix(tipo, chave);
    setSaving(false);
    setToast(
      result.ok
        ? { ok: true, msg: "Chave Pix salva com sucesso!" }
        : { ok: false, msg: result.error }
    );
  }

  // ── 2FA: iniciar enrollment ───────────────────────────
  async function iniciarEnrollment() {
    setMfaSaving(true);
    setMfaToast(null);

    // Limpar fatores não verificados de tentativas anteriores
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const unverified = factors?.totp?.filter((f) => f.status === "unverified") ?? [];
    for (const f of unverified) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Google Authenticator",
    });
    setMfaSaving(false);

    if (error || !data) {
      setMfaToast({ ok: false, msg: "Erro ao gerar QR code. Tente novamente." });
      return;
    }

    setEnrollData({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
    setMfaCode("");
  }

  async function cancelarEnrollment() {
    if (!enrollData) return;
    await supabase.auth.mfa.unenroll({ factorId: enrollData.factorId });
    setEnrollData(null);
    setMfaCode("");
    setMfaToast(null);
  }

  // ── 2FA: confirmar enrollment ─────────────────────────
  async function confirmarEnrollment(e: React.FormEvent) {
    e.preventDefault();
    if (!enrollData) return;
    setMfaSaving(true);
    setMfaToast(null);

    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({
      factorId: enrollData.factorId,
    });
    if (chErr || !challenge) {
      setMfaToast({ ok: false, msg: "Erro ao criar desafio. Tente novamente." });
      setMfaSaving(false);
      return;
    }

    const { error: verErr } = await supabase.auth.mfa.verify({
      factorId: enrollData.factorId,
      challengeId: challenge.id,
      code: mfaCode.trim(),
    });
    setMfaSaving(false);

    if (verErr) {
      setMfaToast({ ok: false, msg: "Código inválido. Verifique o app e tente novamente." });
      return;
    }

    setEnrollData(null);
    setMfaCode("");
    setMfaToast({ ok: true, msg: "2FA ativado com sucesso!" });
    await carregarMfa();
  }

  // ── 2FA: desativar ────────────────────────────────────
  async function desativar2FA(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaFactorId) return;
    setMfaSaving(true);
    setMfaToast(null);

    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({
      factorId: mfaFactorId,
    });
    if (chErr || !challenge) {
      setMfaToast({ ok: false, msg: "Erro ao verificar. Tente novamente." });
      setMfaSaving(false);
      return;
    }

    const { error: verErr } = await supabase.auth.mfa.verify({
      factorId: mfaFactorId,
      challengeId: challenge.id,
      code: mfaCode.trim(),
    });
    if (verErr) {
      setMfaToast({ ok: false, msg: "Código inválido. Verifique o app e tente novamente." });
      setMfaSaving(false);
      return;
    }

    const { error: unenrollErr } = await supabase.auth.mfa.unenroll({ factorId: mfaFactorId });
    setMfaSaving(false);

    if (unenrollErr) {
      setMfaToast({ ok: false, msg: "Erro ao desativar 2FA. Tente novamente." });
      return;
    }

    setShowDisable(false);
    setMfaCode("");
    setMfaToast({ ok: true, msg: "2FA desativado." });
    await carregarMfa();
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-white/40 text-sm">Carregando…</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white px-4 py-8">
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Configurações</h1>
          <p className="text-white/50 text-sm mt-1">
            Gerencie sua chave Pix e segurança da conta.
          </p>
        </div>

        {/* ── Seção Pix ── */}
        <form
          onSubmit={salvar}
          className="rounded-2xl border border-white/8 bg-white/[0.03] p-6 space-y-5"
        >
          <div>
            <h2 className="text-base font-semibold text-white">Chave Pix</h2>
            <p className="text-white/50 text-xs mt-0.5">
              Cadastre sua chave para receber pagamentos dos alunos.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5">Tipo de chave</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoChave)}
              required
              className="w-full bg-white/8 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-white/25 appearance-none"
            >
              <option value="" disabled>Selecione...</option>
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5">Chave Pix</label>
            <input
              value={chave}
              onChange={(e) => setChave(e.target.value)}
              required
              placeholder="Ex.: seu@email.com, CPF, telefone ou chave aleatória"
              className="w-full bg-white/8 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-white/30 outline-none focus:border-white/25"
            />
          </div>

          {toast && (
            <p className={`text-sm rounded-xl p-3 border ${
              toast.ok
                ? "text-white bg-white/5 border-white/10"
                : "text-red-300 bg-red-500/5 border-red-500/15"
            }`}>
              {toast.msg}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-white hover:bg-white/90 disabled:opacity-60 text-black font-semibold py-2.5 rounded-xl transition text-sm"
          >
            {saving ? "Salvando…" : "Salvar chave Pix"}
          </button>
        </form>

        {/* ── Seção 2FA ── */}
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-white">Autenticação em dois fatores (2FA)</h2>
            <p className="text-white/50 text-xs mt-0.5">
              Proteja sua conta com o Google Authenticator ou Authy.
            </p>
          </div>

          {mfaLoading ? (
            <p className="text-white/40 text-sm">Verificando…</p>
          ) : mfaFactorId ? (
            /* ── 2FA ATIVO ── */
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                <span className="text-sm text-white/80">2FA ativo</span>
              </div>

              {mfaToast && (
                <p className={`text-sm rounded-xl p-3 border ${
                  mfaToast.ok
                    ? "text-white bg-white/5 border-white/10"
                    : "text-red-300 bg-red-500/5 border-red-500/15"
                }`}>
                  {mfaToast.msg}
                </p>
              )}

              {!showDisable ? (
                <button
                  type="button"
                  onClick={() => { setShowDisable(true); setMfaCode(""); setMfaToast(null); }}
                  className="text-sm text-red-400 hover:text-red-300 transition"
                >
                  Desativar 2FA
                </button>
              ) : (
                <form onSubmit={desativar2FA} className="space-y-3">
                  <p className="text-xs text-white/50">
                    Insira o código atual do app para confirmar a desativação.
                  </p>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="000000"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                    className="w-full bg-white/8 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm text-center tracking-widest placeholder:text-white/30 outline-none focus:border-white/25"
                    autoFocus
                    required
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={mfaSaving || mfaCode.length !== 6}
                      className="flex-1 bg-red-500/80 hover:bg-red-500 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition text-sm"
                    >
                      {mfaSaving ? "Desativando…" : "Confirmar desativação"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowDisable(false); setMfaCode(""); setMfaToast(null); }}
                      className="px-4 bg-white/5 hover:bg-white/10 text-white/70 font-medium py-2.5 rounded-xl transition text-sm"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            /* ── 2FA INATIVO ── */
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-white/20 shrink-0" />
                <span className="text-sm text-white/50">2FA inativo</span>
              </div>

              {mfaToast && (
                <p className={`text-sm rounded-xl p-3 border ${
                  mfaToast.ok
                    ? "text-white bg-white/5 border-white/10"
                    : "text-red-300 bg-red-500/5 border-red-500/15"
                }`}>
                  {mfaToast.msg}
                </p>
              )}

              {!enrollData ? (
                <button
                  type="button"
                  onClick={iniciarEnrollment}
                  disabled={mfaSaving}
                  className="w-full bg-white hover:bg-white/90 disabled:opacity-60 text-black font-semibold py-2.5 rounded-xl transition text-sm"
                >
                  {mfaSaving ? "Gerando QR code…" : "Ativar 2FA"}
                </button>
              ) : (
                /* ── FLUXO DE ENROLLMENT ── */
                <form onSubmit={confirmarEnrollment} className="space-y-4">
                  <p className="text-xs text-white/60 leading-relaxed">
                    Escaneie o QR code com o <strong className="text-white/80">Google Authenticator</strong> ou <strong className="text-white/80">Authy</strong>, depois insira o código gerado.
                  </p>

                  {/* QR Code */}
                  <div className="flex justify-center">
                    <div className="rounded-xl bg-white p-3 inline-block">
                      <img
                        src={enrollData.qrCode}
                        alt="QR code 2FA"
                        className="w-44 h-44"
                      />
                    </div>
                  </div>

                  {/* Chave manual */}
                  <div>
                    <p className="text-xs text-white/40 mb-1">Ou insira manualmente no app:</p>
                    <code className="block w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white/70 break-all">
                      {enrollData.secret}
                    </code>
                  </div>

                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="Código de 6 dígitos"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                    className="w-full bg-white/8 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm text-center tracking-widest placeholder:text-white/30 outline-none focus:border-white/25"
                    autoFocus
                    required
                  />

                  {mfaToast && (
                    <p className={`text-sm rounded-xl p-3 border ${
                      mfaToast.ok
                        ? "text-white bg-white/5 border-white/10"
                        : "text-red-300 bg-red-500/5 border-red-500/15"
                    }`}>
                      {mfaToast.msg}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={mfaSaving || mfaCode.length !== 6}
                      className="flex-1 bg-white hover:bg-white/90 disabled:opacity-60 text-black font-semibold py-2.5 rounded-xl transition text-sm"
                    >
                      {mfaSaving ? "Ativando…" : "Confirmar e ativar"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelarEnrollment}
                      className="px-4 bg-white/5 hover:bg-white/10 text-white/70 font-medium py-2.5 rounded-xl transition text-sm"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
