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

            <nav className="hidden items-center gap-6 text-sm text-white/70 md:flex">
              <a href="#recursos" className="hover:text-white">Recursos</a>
              <a href="#como-funciona" className="hover:text-white">Como funciona</a>
              <a href="#precos" className="hover:text-white">Preços</a>
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

          {mobileMenuOpen && (
            <div className="md:hidden">
              <div className="mx-auto max-w-6xl px-4 pb-4">
                <div className="rounded-2xl border border-white/10 bg-black/60 p-3 backdrop-blur">
                  <div className="flex flex-col gap-2 text-sm text-white/80">
                    <a href="#recursos" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-3 py-2 hover:bg-white/10">Recursos</a>
                    <a href="#como-funciona" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-3 py-2 hover:bg-white/10">Como funciona</a>
                    <a href="#precos" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-3 py-2 hover:bg-white/10">Preços</a>
                    <div className="my-2 h-px w-full bg-white/10" />
                    <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="rounded-xl bg-white/5 px-3 py-2 font-semibold hover:bg-white/10">
                      Entrar
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="relative h-[45vh] md:h-screen w-full overflow-hidden bg-black">
        <video
          className="absolute inset-0 h-full w-full object-contain md:object-cover object-center"
          src="/videos/hero.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/20" />
        <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.55)]" />
        <div className="relative z-10 h-full w-full pt-10 md:pt-24" />
      </section>

      {/* Bloco de texto hero */}
      <section className="relative z-20 -mt-12 sm:-mt-28 md:-mt-36">
        <div className="mx-auto max-w-6xl px-4">
          <div className="sticky top-16 md:top-20">
            <div className="rounded-2xl border border-white/10 bg-black/55 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.65)] backdrop-blur-md md:p-8">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
                  <span className="h-2 w-2 rounded-full bg-white" />
                  Gestão completa para personal trainers · 7 dias grátis
                </div>

                <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight md:text-5xl">
                  O que seu aluno conquista{" "}
                  <span className="text-white">depende do que você decide hoje.</span>
                </h1>

                <p className="mt-3 text-sm leading-relaxed text-white/75 md:text-base">
                  Motion reúne anamnese, exames médicos, fotos de progresso e histórico
                  de evolução para que você tome a decisão mais acertada de periodização —
                  com a agilidade da IA mais avançada do mercado ao seu lado.
                  Não é a IA que prescreve. É você, com todas as informações.
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
                  <Stat label="Decisão" value="Baseada em dados" />
                  <Stat label="Alunos" value="Ilimitados" />
                  <Stat label="Dados" value="Protegidos" />
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
          Tudo que você precisa para entregar resultado
        </h2>
        <p className="mt-2 max-w-2xl text-white/70">
          Do primeiro atendimento ao acompanhamento da evolução — o Motion centraliza
          cada ferramenta que um personal trainer profissional precisa.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Card
            badge="Análise completa"
            title="Prescrição baseada em dados"
            desc="A IA lê anamnese, exames médicos e fotos do aluno e sugere a periodização ideal para o objetivo dele. Você analisa, ajusta e bate o martelo — com a segurança de quem decidiu com todas as informações na mão."
          />
          <Card
            badge="Catálogo completo"
            title="Biblioteca de exercícios"
            desc="Acesso a uma biblioteca rica de exercícios categorizados por grupo muscular, equipamento e nível. Monte treinos precisos ou deixe a IA sugerir — e adicione exercícios personalizados quando precisar."
          />
          <Card
            badge="Controle total"
            title="Alunos, agenda e financeiro"
            desc="Gerencie todos os seus alunos, organize sua agenda de atendimentos e acompanhe os pagamentos em um só lugar. Menos tempo em planilha, mais tempo com quem importa."
          />
          <Card
            badge="Sua marca"
            title="Sua página de vendas"
            desc="Cada professor recebe uma página pública personalizada com seu perfil, serviços e avaliações reais dos alunos. Compartilhe o link e conquiste novos clientes sem depender de redes sociais."
          />
          <Card
            badge="Dados protegidos"
            title="Privacidade e segurança"
            desc="Fotos, exames e dados de saúde dos seus alunos ficam protegidos com segurança de nível bancário. Você controla exatamente o que cada aluno acessa — nenhuma informação sensível exposta."
          />
          <Card
            badge="Sem taxas"
            title="Pix direto, sem comissão"
            desc="Você define seu preço e recebe direto do aluno via Pix — sem intermediário, sem porcentagem, sem taxa sobre o que é seu. O Motion cobra apenas a mensalidade fixa do professor."
          />
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            Como funciona
          </h2>
          <p className="mt-2 max-w-2xl text-white/70">
            Do cadastro do aluno à entrega do treino — um fluxo simples que respeita
            o seu tempo e a sua metodologia.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            <Step
              n="01"
              title="Perfil completo do aluno"
              desc="Cadastre anamnese, histórico, exames médicos e fotos de progresso. Tudo em um único perfil."
            />
            <Step
              n="02"
              title="IA analisa cada dado"
              desc="A inteligência artificial lê o perfil completo e sugere a periodização mais adequada ao objetivo do aluno."
            />
            <Step
              n="03"
              title="Você decide e aprova"
              desc="Revisa, ajusta exercícios, séries e cargas — e libera o treino quando estiver perfeito. A decisão é sempre sua."
            />
            <Step
              n="04"
              title="Acompanhe a evolução"
              desc="Aluno acessa o treino pelo app, você acompanha a progressão, organiza a agenda e controla os recebimentos."
            />
          </div>

          <div className="mt-10 rounded-2xl border border-white/8 bg-white/[0.03] p-6 md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-white/80">
                  Seu negócio, do seu jeito
                </p>
                <p className="mt-1 text-white/70">
                  Defina seus preços, receba via Pix sem taxa e controle o acesso
                  de cada aluno. O Motion cuida da organização — você cuida dos resultados.
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
            Um plano completo para você começar hoje e crescer sem limite.
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
                  "Periodização com análise de anamnese, exames e fotos",
                  "IA mais avançada do mercado (Claude · Anthropic)",
                  "Biblioteca completa de exercícios",
                  "Alunos ilimitados",
                  "Agenda e controle financeiro integrados",
                  "Página de vendas personalizada com avaliações",
                  "Controle de acesso por aluno",
                  "Pix direto sem taxas ou comissões",
                  "Dados protegidos com segurança e privacidade",
                ].map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span className="mt-0.5 text-xs text-white shrink-0">✓</span>
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

            <div className="flex max-w-xs flex-col gap-5 pt-2 text-sm text-white/60 md:pt-6">
              <div>
                <p className="font-medium text-white/80">Você recebe. Sem intermediário.</p>
                <p className="mt-1">
                  Defina o valor que quiser, receba via Pix diretamente do aluno.
                  Nenhuma comissão sobre o que é seu.
                </p>
              </div>
              <div>
                <p className="font-medium text-white/80">Sua metodologia, preservada.</p>
                <p className="mt-1">
                  A IA sugere, você decide. Edite qualquer exercício, série ou carga
                  antes de liberar para o aluno.
                </p>
              </div>
              <div>
                <p className="font-medium text-white/80">Controle total do acesso.</p>
                <p className="mt-1">
                  Ative, pause ou remova o acesso de qualquer aluno quando quiser.
                </p>
              </div>
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
              <span className="uppercase tracking-[0.22em] text-white">MOTION</span>
              . Todos os direitos reservados.
            </p>
          </div>
          <div className="flex gap-4 text-sm text-white/60">
            <Link href="/termos" className="hover:text-white">Termos</Link>
            <Link href="/privacidade" className="hover:text-white">Privacidade</Link>
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

function Card({ title, desc, badge }: { title: string; desc: string; badge: string }) {
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
