"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  const [hideHeader, setHideHeader] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setHideHeader(window.scrollY > 80);
      if (window.scrollY > 10) setMobileMenuOpen(false);
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ${
          hideHeader ? "-translate-y-full" : "translate-y-0"
        }`}
      >
        <div className="border-b border-white/10 bg-black/35 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/images/motion-m-green.png"
                alt="Motion"
                width={36}
                height={36}
                priority
                className="h-9 w-9"
              />
              <span className="text-[15px] font-semibold uppercase tracking-[0.28em]">
                MOTION
                <span className="ml-3 text-[10px] font-medium tracking-normal text-white/50">
                  for trainers
                </span>
              </span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden items-center gap-6 text-sm text-white/70 md:flex">
              <a href="#como-funciona" className="hover:text-white">
                Como funciona
              </a>
              <a href="#recursos" className="hover:text-white">
                Recursos
              </a>
              <a href="#precos" className="hover:text-white">
                Preços
              </a>
            </nav>

            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="hidden rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:border-white/40 hover:text-white md:inline-flex"
              >
                Entrar
              </Link>
              <button
                type="button"
                aria-label="Abrir menu"
                onClick={() => setMobileMenuOpen((v) => !v)}
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-3 py-2 text-white/90 hover:bg-white/10 md:hidden"
              >
                <span className="text-lg leading-none">☰</span>
              </button>
            </div>
          </div>

          {/* Mobile dropdown */}
          {mobileMenuOpen ? (
            <div className="md:hidden">
              <div className="mx-auto max-w-6xl px-4 pb-4">
                <div className="rounded-2xl border border-white/10 bg-black/60 p-3 backdrop-blur">
                  <div className="flex flex-col gap-2 text-sm text-white/80">
                    <a
                      href="#como-funciona"
                      onClick={() => setMobileMenuOpen(false)}
                      className="rounded-xl px-3 py-2 hover:bg-white/10"
                    >
                      Como funciona
                    </a>
                    <a
                      href="#recursos"
                      onClick={() => setMobileMenuOpen(false)}
                      className="rounded-xl px-3 py-2 hover:bg-white/10"
                    >
                      Recursos
                    </a>
                    <a
                      href="#precos"
                      onClick={() => setMobileMenuOpen(false)}
                      className="rounded-xl px-3 py-2 hover:bg-white/10"
                    >
                      Preços
                    </a>
                    <div className="my-2 h-px w-full bg-white/10" />
                    <Link
                      href="/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className="rounded-xl bg-white/5 px-3 py-2 font-semibold hover:bg-white/10"
                    >
                      Entrar
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      {/* Hero — capa full-screen */}
      <section className="relative h-screen w-full overflow-hidden">
        <video
          className="absolute inset-0 h-full w-full object-cover object-center md:hidden"
          src="/videos/capa-mobile.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster="/images/capa.png"
        />
        <img
          src="/images/capa.png"
          alt="Motion - Capa"
          className="absolute inset-0 hidden h-full w-full object-cover object-center md:block"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" />
        <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.55)]" />
        <div className="relative z-10 h-full w-full pt-20 md:pt-24" />
      </section>

      {/* Bloco de texto — entra por cima da capa ao rolar */}
      <section className="relative z-20 -mt-24 sm:-mt-28 md:-mt-36">
        <div className="mx-auto max-w-6xl px-4">
          <div className="sticky top-16 md:top-20">
            <div className="rounded-2xl border border-white/10 bg-black/55 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.65)] backdrop-blur-md md:p-8">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
                  <span className="h-2 w-2 rounded-full bg-white" />
                  Geração de treinos com IA · Teste grátis 7 dias
                </div>

                <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight md:text-5xl">
                  Treinos personalizados com IA,{" "}
                  <span className="text-white">entregues pelo seu nome</span>
                </h1>

                <p className="mt-3 text-sm leading-relaxed text-white/75 md:text-base">
                  O Motion usa Claude, a IA da Anthropic, para montar planos de
                  treino periodizados lendo a anamnese completa do aluno, fotos
                  de progresso e exames médicos — tudo com a sua identidade, sem
                  intermediários.
                </p>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-black hover:bg-white/90"
                  >
                    Começar teste grátis
                  </Link>
                  <a
                    href="#como-funciona"
                    className="inline-flex items-center justify-center rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white/90 hover:border-white/30"
                  >
                    Ver como funciona
                  </a>
                </div>

                <div className="mt-7 grid grid-cols-3 gap-3 text-center">
                  <Stat label="IA" value="Claude" />
                  <Stat label="Alunos" value="Ilimitados" />
                  <Stat label="Acesso" value="Controlado" />
                </div>

                <p className="mt-5 text-xs text-white/45">
                  7 dias grátis, depois R$ 59,90/mês. Cancele quando quiser.
                </p>
              </div>
            </div>
            <div className="h-10 md:h-14" />
          </div>
        </div>
      </section>

      {/* Recursos */}
      <section id="recursos" className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
          Ferramentas que economizam horas por semana
        </h2>
        <p className="mt-2 max-w-2xl text-white/70">
          Da anamnese ao treino pronto: a IA faz o trabalho pesado enquanto
          você mantém o controle total sobre cada plano.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Card
            title="Treinos gerados por IA"
            desc="A IA da Anthropic lê a anamnese, histórico e fotos do aluno e monta um plano completo com rotinas separadas por dia — você revisa e ajusta antes de salvar."
            badge="Powered by Claude"
          />
          <Card
            title="Modelos reutilizáveis"
            desc="Crie um treino para idoso hipertenso, gestante ou atleta de alto rendimento e atribua a quantos alunos quiser com um clique."
            badge="Templates IA"
          />
          <Card
            title="Controle total"
            desc="Edite qualquer exercício do treino gerado — séries, reps, descanso, observações. Aluno só acessa quando você ativa."
            badge="Você no comando"
          />
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            Como funciona
          </h2>

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            <Step n="01" title="Crie sua conta" desc="7 dias grátis, depois R$ 59,90/mês." />
            <Step n="02" title="Cadastre seus alunos" desc="Anamnese, histórico e fotos de progresso em um só lugar." />
            <Step n="03" title="Gere o treino com IA" desc="Claude lê o perfil do aluno e monta o plano. Você revisa e aprova." />
            <Step n="04" title="Atribua com um clique" desc="Aluno recebe o plano e acessa via app." />
          </div>

          <div className="mt-10 rounded-2xl border border-white/8 bg-white/[0.03] p-6 md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-white/80">
                  Você cobra do jeito que preferir
                </p>
                <p className="mt-1 text-white/70">
                  Pix direto entre você e o aluno — sem comissão sobre os seus
                  alunos. O Motion cuida da organização, treinos e acesso.
                </p>
              </div>
              <Link
                href="/login"
                className="inline-flex shrink-0 items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-black hover:bg-white/90"
              >
                Começar agora
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="precos" className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            Simples. Sem surpresas.
          </h2>
          <p className="mt-2 text-white/70">
            Um plano para você começar hoje e escalar no seu ritmo.
          </p>

          <div className="mt-8 flex flex-col gap-8 md:flex-row md:items-start">
            <div className="w-full max-w-sm rounded-2xl border border-white/8 bg-white/[0.03] p-8">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
                Motion Pro
              </p>
              <div className="mt-4 flex items-end gap-1">
                <span className="text-4xl font-bold">R$ 59,90</span>
                <span className="mb-1 text-sm text-white/50">/mês</span>
              </div>
              <p className="mt-1 text-sm text-white/50">
                7 dias grátis — cancele quando quiser
              </p>

              <ul className="mt-6 space-y-3 text-sm text-white/70">
                {[
                  "Geração de treinos com IA (Claude · Anthropic)",
                  "Treinos-modelo reutilizáveis por perfil de aluno",
                  "Alunos ilimitados",
                  "Anamnese, fotos de progresso e exames",
                  "Controle de acesso por aluno",
                  "Perfil público do professor",
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <span className="text-xs text-white">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href="/login"
                className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-black hover:bg-white/90"
              >
                Começar teste grátis
              </Link>
              <p className="mt-3 text-center text-xs text-white/35">
                Cartão necessário. Sem cobrança nos primeiros 7 dias.
              </p>
            </div>

            <div className="flex max-w-xs flex-col gap-4 pt-2 text-sm text-white/60 md:pt-6">
              <p className="font-medium text-white/80">
                O aluno paga direto com você
              </p>
              <p>
                Você define o valor e recebe via Pix. O Motion cuida da
                organização, treinos e acesso — sem comissão sobre os seus
                alunos.
              </p>
              <p>
                Você tem controle total: ativa, pausa ou remove o acesso do
                aluno quando quiser.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/images/motion-m-green.png"
              alt="Motion"
              width={26}
              height={26}
              className="h-7 w-7"
            />
            <p className="text-sm text-white/70">
              © {new Date().getFullYear()}{" "}
              <span className="uppercase tracking-[0.22em] text-white">
                MOTION
              </span>
              . Todos os direitos reservados.
            </p>
          </div>
          <div className="flex gap-4 text-sm text-white/60">
            <Link href="/termos" className="hover:text-white">
              Termos
            </Link>
            <Link href="/privacidade" className="hover:text-white">
              Privacidade
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-xs text-white/50">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function Card({
  title,
  desc,
  badge,
}: {
  title: string;
  desc: string;
  badge: string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
      <div className="inline-flex items-center rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-white/70">
        {badge}
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/70">{desc}</p>
    </div>
  );
}

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
      <p className="text-sm font-semibold text-white/40">{n}</p>
      <h4 className="mt-3 font-semibold">{title}</h4>
      <p className="mt-2 text-sm text-white/70">{desc}</p>
    </div>
  );
}
