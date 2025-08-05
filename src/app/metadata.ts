// src/app/metadata.ts (NÃO coloque "use client" aqui!)

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Jeferson Parowski Personal - Treino Fitness Online e Presencial",
  description: "Transforme seu corpo e mente com treinos personalizados e acompanhamento exclusivo em Ponta Grossa, PR. Foco em resultados reais e metodologia futurista.",
  keywords: ["personal trainer", "Jeferson Parowski", "treino online", "treino presencial", "fitness", "Ponta Grossa", "Paraná", "academia", "saúde", "bem-estar", "consultoria fitness"],
  openGraph: {
    title: "Jeferson Parowski Personal",
    description: "Transforme seu corpo e mente com treinos personalizados e acompanhamento exclusivo.",
    url: "https://jefersonparowski.vercel.app",
    siteName: "Jeferson Parowski Personal",
    images: [
      {
        url: "/images/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Jeferson Parowski Personal Trainer",
      },
    ],
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Jeferson Parowski Personal - Treino Fitness Online e Presencial",
    description: "Transforme seu corpo e mente com treinos personalizados e acompanhamento exclusivo.",
    images: ["/images/twitter-image.jpg"],
  },
};