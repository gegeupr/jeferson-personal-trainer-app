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
    <main className="min-h-screen bg-black text-white">
      {/* Header overlay (some ao rolar) */}
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
                <span className="text-lime-400">M</span>
                <span className="text-white">OTION</span>
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
              <a href="#seguranca" className="hover:text-white">
                Segurança
              </a>
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-2">
              {/* Apenas Entrar (desktop) */}
              <Link
                href="/login"
                className="hidden rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:border-white/40 hover:text-white md:inline-flex"
              >
                Entrar
              </Link>

              {/* Mobile menu button */}
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

          {/* Mobile dropdown menu */}
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
                      href="#seguranca"
                      onClick={() => setMobileMenuOpen(false)}
                      className="rounded-xl px-3 py-2 hover:bg-white/10"
                    >
                      Segurança
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

      {/* ✅ CAPA LIMPA (sem texto) | Mobile = vídeo 9:16 | Desktop = imagem 16:9 */}
      <section className="relative h-screen w-full overflow-hidden">
        {/* ✅ Mobile video (coloque em: public/videos/capa-mobile.mp4) */}
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

        {/* ✅ Desktop image (coloque em: public/images/capa.png) */}
        <img
          src="/images/capa.png"
          alt="Motion - Capa"
          className="absolute inset-0 hidden h-full w-full object-cover object-center md:block"
          loading="eager"
        />

        {/* overlays premium (bem discretos) */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" />
        <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.55)]" />

        {/* espaço do header (não tem conteúdo aqui, é só para não “cortar” a capa) */}
        <div className="relative z-10 h-full w-full pt-20 md:pt-24" />
      </section>

      {/* ✅ BLOCO DE TEXTO ABAIXO DA CAPA, mas “entra por cima” ao começar a rolar */}
      <section className="relative z-20 -mt-24 sm:-mt-28 md:-mt-36">
        <div className="mx-auto max-w-6xl px-4">
          {/* sticky cria o efeito premium: texto “passa por cima” da capa */}
          <div className="sticky top-16 md:top-20">
            <div className="rounded-3xl border border-white/10 bg-black/55 p-6 backdrop-blur-md shadow-[0_25px_80px_rgba(0,0,0,0.65)] md:p-8">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
                  <span className="h-2 w-2 rounded-full bg-lime-400" />
                  Plataforma gratuita para professores
                </div>

                <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight md:text-5xl">
                  Gestão inteligente para{" "}
                  <span className="text-lime-400">personal trainers</span>
                </h1>

                <p className="mt-3 text-sm leading-relaxed text-white/75 md:text-base">
                  Organize alunos, treinos, biblioteca de exercícios e evolução
                  em um só lugar — com visual premium e controle real de acesso
                  do aluno.
                </p>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center rounded-full bg-lime-400 px-6 py-3 text-sm font-semibold text-black hover:bg-lime-300"
                  >
                    Criar conta grátis
                  </Link>

                  <a
                    href="#como-funciona"
                    className="inline-flex items-center justify-center rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white/90 hover:border-white/30"
                  >
                    Ver como funciona
                  </a>
                </div>

                <div className="mt-7 grid grid-cols-3 gap-3 text-center">
                  <Stat label="Treinos" value="Rápidos" />
                  <Stat label="Biblioteca" value="Sua" />
                  <Stat label="Acesso" value="Controlado" />
                </div>

                <p className="mt-5 text-xs text-white/45">
                  Pagamento do aluno direto com o professor (Pix/links). O Motion
                  organiza o acesso e a gestão.
                </p>
              </div>
            </div>

            {/* “respiro” para o sticky não ficar prendendo demais */}
            <div className="h-10 md:h-14" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="recursos" className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
          Feito para o seu dia a dia
        </h2>
        <p className="mt-2 max-w-2xl text-white/70">
          Você mantém sua metodologia, seus nomes de exercícios, seus vídeos e
          seu relacionamento direto com o aluno.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Card
            title="Biblioteca própria"
            desc="Cada professor cria seus exercícios com o nome da sua região e pode linkar seu vídeo do YouTube."
            badge="Professor"
          />
          <Card
            title="Treinos reutilizáveis"
            desc="Monte, salve e atribua treinos para cada aluno. Rápido de ajustar, fácil de evoluir."
            badge="Gestão"
          />
          <Card
            title="Acesso do aluno"
            desc="Aluno só acessa quando estiver ativo. Você controla o status e mantém tudo organizado."
            badge="Controle"
          />
        </div>
      </section>

      {/* How it works */}
      <section id="como-funciona" className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            Como funciona
          </h2>

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            <Step n="01" title="Crie sua conta" desc="Professor entra grátis." />
            <Step n="02" title="Monte sua biblioteca" desc="Exercícios + vídeos." />
            <Step n="03" title="Crie e salve treinos" desc="Rotinas e planos." />
            <Step n="04" title="Atribua ao aluno" desc="Acesso conforme status." />
          </div>

          <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-lime-400">
                  Pagamento do aluno direto com você
                </p>
                <p className="mt-1 text-white/70">
                  Pix, Mercado Pago, PicPay… você escolhe. O Motion organiza o
                  acesso e a gestão.
                </p>
              </div>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-full bg-lime-400 px-6 py-3 text-sm font-semibold text-black hover:bg-lime-300"
              >
                Começar agora
              </Link>
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
              <span className="uppercase tracking-[0.22em]">
                <span className="text-lime-400">M</span>OTION
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
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
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
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <p className="text-sm font-semibold text-lime-400">{n}</p>
      <h4 className="mt-3 font-semibold">{title}</h4>
      <p className="mt-2 text-sm text-white/70">{desc}</p>
    </div>
  );
}