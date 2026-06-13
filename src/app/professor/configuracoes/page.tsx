"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase-browser";

type TipoChave = "cpf" | "email" | "telefone" | "aleatoria";

const TIPOS: { value: TipoChave; label: string }[] = [
  { value: "cpf", label: "CPF" },
  { value: "email", label: "E-mail" },
  { value: "telefone", label: "Telefone" },
  { value: "aleatoria", label: "Chave aleatória" },
];

export default function ConfiguracoesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uid, setUid] = useState<string | null>(null);

  const [tipo, setTipo] = useState<TipoChave | "">("");
  const [chave, setChave] = useState("");
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) return;
      setUid(user.id);

      const { data } = await supabase
        .from("profiles")
        .select("chave_pix, tipo_chave_pix")
        .eq("id", user.id)
        .maybeSingle();

      setChave(data?.chave_pix ?? "");
      setTipo((data?.tipo_chave_pix as TipoChave) ?? "");
      setLoading(false);
    })();
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!uid) return;
    setSaving(true);
    setToast(null);

    const { error } = await supabase
      .from("profiles")
      .update({
        chave_pix: chave.trim() || null,
        tipo_chave_pix: tipo || null,
      })
      .eq("id", uid);

    setSaving(false);
    setToast(
      error
        ? { ok: false, msg: "Não foi possível salvar. Tente novamente." }
        : { ok: true, msg: "Chave Pix salva com sucesso!" }
    );
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
            Cadastre sua chave Pix para receber os pagamentos dos seus alunos.
          </p>
        </div>

        <form
          onSubmit={salvar}
          className="rounded-2xl border border-white/8 bg-white/[0.03] p-6 space-y-5"
        >
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
            {saving ? "Salvando..." : "Salvar chave Pix"}
          </button>
        </form>
      </div>
    </main>
  );
}
