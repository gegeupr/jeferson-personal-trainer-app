import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import CommunitySection from "@/components/community/CommunitySection";

type ProfessorPublic = {
  id: string;
  slug: string;
  nome_completo: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  especialidades: string[] | null;
  cidade: string | null;
  instagram: string | null;
  pagamento: any;
};

async function getBaseUrl() {
  // Next 15: headers() pode ser async em alguns contextos
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") || "http";
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

export default async function ProfessorPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    (await getBaseUrl());

  const res = await fetch(
    `${baseUrl}/api/public/professor/${encodeURIComponent(slug)}`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold">Professor não encontrado</h1>
          <p className="mt-2 text-white/60">
            Verifique o link e tente novamente.
          </p>
          <Link
            href="/"
            className="inline-block mt-6 rounded-full bg-lime-400 px-6 py-3 text-sm font-semibold text-black hover:bg-lime-300"
          >
            Voltar ao Motion
          </Link>
        </div>
      </main>
    );
  }

  const prof = (await res.json()) as ProfessorPublic;

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="relative h-[260px] w-full">
        {prof.cover_url ? (
          <Image
            src={prof.cover_url}
            alt="Capa"
            fill
            className="object-cover opacity-80"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(163,230,53,0.18),rgba(0,0,0,0)_55%)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black" />
      </div>

      <div className="mx-auto max-w-4xl px-5 -mt-16 pb-16">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center">
            <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
              {prof.avatar_url ? (
                <Image
                  src={prof.avatar_url}
                  alt="Avatar"
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-lime-300 font-bold">
                  {prof.nome_completo?.slice(0, 1)?.toUpperCase() ?? "M"}
                </div>
              )}
            </div>

            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold">
                {prof.nome_completo || "Professor"}
              </h1>
              <p className="mt-1 text-white/60 text-sm">
                {prof.cidade ? prof.cidade : "Personal Trainer • Motion"}
              </p>

              {prof.bio && (
                <p className="mt-3 text-white/80 text-sm leading-relaxed">
                  {prof.bio}
                </p>
              )}

              {prof.especialidades?.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {prof.especialidades.slice(0, 10).map((s) => (
                    <span
                      key={s}
                      className="rounded-full border border-lime-400/20 bg-lime-400/10 px-3 py-1 text-xs text-lime-200"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 w-full sm:w-auto">
              <Link
                href={`/login?prof=${encodeURIComponent(prof.slug)}`}
                className="rounded-full bg-lime-400 px-6 py-3 text-sm font-semibold text-black hover:bg-lime-300 text-center"
              >
                Treinar comigo
              </Link>
              <Link
                href="/"
                className="rounded-full bg-white/5 px-6 py-3 text-sm font-semibold text-white/90 hover:bg-white/10 text-center border border-white/10"
              >
                Conhecer o Motion
              </Link>
            </div>
          </div>

          {prof.instagram && (
            <div className="mt-6 text-sm text-white/70">
              Instagram: <span className="text-lime-300">@{prof.instagram}</span>
            </div>
          )}
          <CommunitySection professorId={prof.id} professorSlug={prof.slug} />
        </div>
      </div>
    </main>
  );
}
