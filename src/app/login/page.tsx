// src/app/login/page.tsx
"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/utils/supabase-browser";

const PROF_STORAGE_KEY = "motion_prof_slug";
const WELCOME_PENDING_KEY = "motion_welcome_pending";

// ✅ cooldown do reset (persistente)
const RESET_COOLDOWN_UNTIL_KEY = "motion_reset_cooldown_until";

function getSiteUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

// ---------------------
// Phone helpers (BR)
// ---------------------
function onlyDigits(s: string) {
  return (s || "").replace(/\D/g, "");
}

function normalizeBRPhone(raw: string) {
  return onlyDigits(raw);
}

function isValidBRPhone(raw: string) {
  const d = onlyDigits(raw);

  if (d.startsWith("55")) {
    const rest = d.slice(2);
    return rest.length === 10 || rest.length === 11;
  }
  return d.length === 10 || d.length === 11;
}

// ✅ helpers cooldown
function readCooldownUntil(): number {
  if (typeof window === "undefined") return 0;
  const v = localStorage.getItem(RESET_COOLDOWN_UNTIL_KEY);
  const n = v ? Number(v) : 0;
  return Number.isFinite(n) ? n : 0;
}

function writeCooldownUntil(untilMs: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(RESET_COOLDOWN_UNTIL_KEY, String(untilMs));
}

function formatMMSS(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const profFromUrl = useMemo(
    () => (searchParams.get("prof") || "").trim().toLowerCase(),
    [searchParams]
  );

  const [isLoginView, setIsLoginView] = useState(true);
  const [role, setRole] = useState<"aluno" | "professor">("aluno");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [nomeCompleto, setNomeCompleto] = useState("");
  const [telefone, setTelefone] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // --- reset senha (card)
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetErr, setResetErr] = useState<string | null>(null);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  // ✅ estado do cooldown
  const [cooldownUntil, setCooldownUntil] = useState<number>(0);
  const [cooldownNow, setCooldownNow] = useState<number>(() => Date.now());

  const cooldownLeftSeconds = useMemo(() => {
    if (!cooldownUntil) return 0;
    const diff = Math.ceil((cooldownUntil - cooldownNow) / 1000);
    return Math.max(0, diff);
  }, [cooldownUntil, cooldownNow]);

  const isCooldownActive = cooldownLeftSeconds > 0;

  // ✅ carrega cooldown salvo (persistente)
  useEffect(() => {
    setCooldownUntil(readCooldownUntil());
  }, []);

  // ✅ timer para atualizar contagem
  useEffect(() => {
    if (!isCooldownActive) return;

    const t = setInterval(() => setCooldownNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [isCooldownActive]);

  // Se entrou via link do professor: /login?prof=slug
  useEffect(() => {
    if (!profFromUrl) return;
    localStorage.setItem(PROF_STORAGE_KEY, profFromUrl);
    localStorage.setItem(WELCOME_PENDING_KEY, "1"); // welcome 1x
    setRole("aluno");
    setIsLoginView(false); // abre cadastro direto (funil)

    // fecha reset, se estava aberto
    setShowReset(false);
    setResetErr(null);
    setResetMsg(null);
  }, [profFromUrl]);

  async function tryLinkAlunoToProfessorIfNeeded() {
    const profSlug = (localStorage.getItem(PROF_STORAGE_KEY) || "")
      .trim()
      .toLowerCase();
    if (!profSlug) return;

    const { data, error } = await supabase.rpc("link_aluno_to_professor_slug", {
      prof_slug: profSlug,
    });

    if (!error && data?.ok) {
      localStorage.removeItem(PROF_STORAGE_KEY);
      localStorage.setItem(WELCOME_PENDING_KEY, "1");
    }
  }

  // -------------------
  // RESET SENHA (EMAIL)
  // -------------------
  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();

    // ✅ bloqueio local se estiver em cooldown
    if (isCooldownActive) {
      setResetErr(
        `Aguarde ${formatMMSS(cooldownLeftSeconds)} para solicitar um novo e-mail.`
      );
      return;
    }

    setResetLoading(true);
    setResetErr(null);
    setResetMsg(null);

    try {
      const emailToUse = (resetEmail || email).trim();
      if (!emailToUse) {
        setResetErr("Informe seu e-mail para receber o link.");
        setResetLoading(false);
        return;
      }

      const redirectTo = `${getSiteUrl()}/redefinir-senha`;

      const { error: rErr } = await supabase.auth.resetPasswordForEmail(
        emailToUse,
        { redirectTo }
      );

      if (rErr) throw rErr;

      // ✅ cooldown padrão (60s) para evitar spam/cliques
      const until = Date.now() + 60 * 1000;
      setCooldownUntil(until);
      writeCooldownUntil(until);

      setResetMsg(
        "Enviamos um link de recuperação para seu e-mail. Verifique a caixa de entrada e spam."
      );
    } catch (err: any) {
      const msg = (err?.message || "").toLowerCase();

      // ✅ caso clássico do Supabase
      if (msg.includes("rate limit") || msg.includes("too many requests")) {
        // cooldown maior (5 min)
        const until = Date.now() + 5 * 60 * 1000;
        setCooldownUntil(until);
        writeCooldownUntil(until);

        setResetErr(
          "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente."
        );
      } else {
        setResetErr(err?.message || "Não foi possível enviar o e-mail de recuperação.");
      }
    } finally {
      setResetLoading(false);
    }
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isLoginView) {
        // -------------------
        // LOGIN
        // -------------------
        const { data, error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (loginError) throw loginError;

        const user = data.user;
        if (!user) throw new Error("Falha ao autenticar. Tente novamente.");

        await tryLinkAlunoToProfessorIfNeeded();
        router.push("/dashboard");
        return;
      }

      // -------------------
      // CADASTRO
      // -------------------
      const profSlug = (localStorage.getItem(PROF_STORAGE_KEY) || "")
        .trim()
        .toLowerCase();

      if (!nomeCompleto.trim()) {
        setError("Informe seu nome completo.");
        setLoading(false);
        return;
      }

      if (!telefone.trim()) {
        setError("Informe seu telefone (WhatsApp) para contato.");
        setLoading(false);
        return;
      }

      if (!isValidBRPhone(telefone)) {
        setError("Telefone inválido. Use DDD + número. Ex: (42) 99999-9999");
        setLoading(false);
        return;
      }

      const telefoneNorm = normalizeBRPhone(telefone);

      const nextAfterConfirm =
        profSlug && role === "aluno"
          ? `/login?prof=${encodeURIComponent(profSlug)}`
          : "/dashboard";

      const redirectTo = `${getSiteUrl()}/auth/callback?next=${encodeURIComponent(
        nextAfterConfirm
      )}`;

      const { error: registerError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            nome_completo: nomeCompleto,
            telefone: telefoneNorm,
            role: role,
          },
        },
      });

      if (registerError) throw registerError;

      setMessage("Cadastro realizado! Verifique seu email para confirmar a conta.");
      setIsLoginView(true);

      setShowReset(false);
      setResetErr(null);
      setResetMsg(null);
    } catch (err: any) {
      const msg = err?.message || "Ocorreu um erro. Por favor, tente novamente.";

      if (msg === "Invalid login credentials") setError("Email ou senha incorretos.");
      else if (msg === "Email not confirmed") setError("Email não confirmado. Verifique sua caixa de entrada.");
      else setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-lime-400 text-black text-2xl font-extrabold">
            M
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-lime-300">
            {isLoginView ? "Entrar" : "Criar conta"}
          </h1>

          {profFromUrl && (
            <p className="mt-2 text-sm text-white/70">
              Você está entrando para treinar com um professor no{" "}
              <span className="text-lime-300 font-semibold">Motion</span>.
            </p>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </p>
        )}

        {message && (
          <p className="mt-4 rounded-xl border border-lime-400/20 bg-lime-400/10 p-3 text-sm text-lime-200">
            {message}
          </p>
        )}

        {/* ✅ CARD ESQUECI SENHA (só no login) */}
        {isLoginView && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => {
                setShowReset((v) => !v);
                setResetErr(null);
                setResetMsg(null);
                setResetEmail(email);
              }}
              className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold text-white/80 hover:bg-white/5 transition"
            >
              {showReset ? "Fechar recuperação de senha" : "Esqueci minha senha"}
            </button>

            {showReset && (
              <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs text-white/60">
                  Informe seu e-mail. Enviaremos um link para redefinir a senha.
                </p>

                {resetErr ? (
                  <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
                    {resetErr}
                  </p>
                ) : null}

                {resetMsg ? (
                  <p className="mt-3 rounded-xl border border-lime-400/20 bg-lime-400/10 p-3 text-sm text-lime-200">
                    {resetMsg}
                  </p>
                ) : null}

                <form onSubmit={handleResetPassword} className="mt-3 space-y-3">
                  <input
                    type="email"
                    placeholder="Seu e-mail"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-lime-400/40"
                    required
                  />

                  <button
                    type="submit"
                    disabled={resetLoading || isCooldownActive}
                    className="w-full rounded-2xl bg-lime-400 px-4 py-3 text-sm font-bold text-black hover:bg-lime-300 disabled:opacity-60"
                  >
                    {resetLoading
                      ? "Enviando..."
                      : isCooldownActive
                      ? `Aguarde ${formatMMSS(cooldownLeftSeconds)}`
                      : "Enviar link de recuperação"}
                  </button>

                  <p className="text-[11px] text-white/40 leading-relaxed">
                    Dica: confira a caixa de spam. Por segurança, o reenvio fica
                    disponível após alguns segundos.
                  </p>
                </form>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleAuth} className="mt-6 space-y-4">
          {!isLoginView && (
            <>
              <div className="rounded-2xl border border-white/10 bg-black/40 p-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole("aluno")}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                      role === "aluno"
                        ? "bg-lime-400 text-black"
                        : "bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                  >
                    Sou aluno
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole("professor")}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                      role === "professor"
                        ? "bg-lime-400 text-black"
                        : "bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                    disabled={!!profFromUrl}
                    title={profFromUrl ? "Cadastro via link do professor é para alunos." : undefined}
                  >
                    Sou professor
                  </button>
                </div>
              </div>

              <input
                type="text"
                placeholder="Nome completo"
                value={nomeCompleto}
                onChange={(e) => setNomeCompleto(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-lime-400/40"
                required
              />

              <input
                type="tel"
                placeholder="Telefone (WhatsApp) com DDD"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-lime-400/40"
                required
              />
            </>
          )}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-lime-400/40"
            required
          />

          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-lime-400/40"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-lime-400 px-4 py-3 text-sm font-bold text-black hover:bg-lime-300 disabled:opacity-60"
          >
            {loading ? "Carregando..." : isLoginView ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <div className="mt-5 text-center text-sm text-white/70">
          {isLoginView ? "Não tem conta?" : "Já tem conta?"}{" "}
          <button
            disabled={loading}
            onClick={() => {
              setIsLoginView(!isLoginView);
              setError(null);
              setMessage(null);

              setShowReset(false);
              setResetErr(null);
              setResetMsg(null);
            }}
            className="text-lime-300 hover:underline"
            type="button"
          >
            {isLoginView ? "Criar agora" : "Fazer login"}
          </button>
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-xs text-white/50 hover:text-white/70">
            Voltar para o início
          </Link>
        </div>
      </div>
    </main>
  );
}

// Wrapper com Suspense para uso do useSearchParams com Next 15
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-950 flex items-center justify-center text-white text-xl">
          Carregando…
        </main>
      }
    >
      <LoginInner />
    </Suspense>
  );
}