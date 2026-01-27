"use client";

import Image from "next/image";
import Link from "next/link";

type Props = {
  // se não passar, usa /images/capa.jpg
  src?: string;
  alt?: string;

  kicker?: string;
  title?: React.ReactNode;
  subtitle?: string;

  ctaHref?: string;
  ctaLabel?: string;

  // altura do hero
  mobileH?: string;
  desktopH?: string;
};

export default function HeroCover16x9({
  src = "/images/capa.jpg",
  alt = "Capa Motion",
  kicker,
  title,
  subtitle,
  ctaHref,
  ctaLabel,
  mobileH = "h-[52vh]",
  desktopH = "md:h-[92vh]",
}: Props) {
  return (
    <section className="relative w-full overflow-hidden">
      <div className={`relative w-full ${mobileH} ${desktopH}`}>
        <Image
          src={src}
          alt={alt}
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />

        {/* overlays premium para leitura */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />

        {/* vinheta */}
        <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.75)]" />

        {/* conteúdo */}
        <div className="absolute inset-0">
          <div className="mx-auto flex h-full max-w-6xl items-end px-4 pb-10 md:pb-14">
            <div className="max-w-xl">
              {kicker ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 backdrop-blur">
                  <span className="h-2 w-2 rounded-full bg-lime-400" />
                  {kicker}
                </div>
              ) : null}

              {title ? (
                <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight md:text-5xl">
                  {title}
                </h1>
              ) : null}

              {subtitle ? (
                <p className="mt-3 text-sm leading-relaxed text-white/75 md:text-base">
                  {subtitle}
                </p>
              ) : null}

              {ctaHref && ctaLabel ? (
                <div className="mt-5">
                  <Link
                    href={ctaHref}
                    className="inline-flex items-center justify-center rounded-full bg-lime-400 px-6 py-3 text-sm font-semibold text-black hover:bg-lime-300"
                  >
                    {ctaLabel}
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}