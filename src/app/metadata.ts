// src/app/metadata.ts (NÃO coloque "use client" aqui!)

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Motion — Plataforma para Personal Trainers",
  description:
    "Gerencie alunos, treinos e biblioteca de exercícios em um só lugar. 7 dias grátis, depois R$ 59,90/mês. Feito para personal trainers que querem organização e profissionalismo.",
  keywords: [
    "motion",
    "plataforma para personal trainer",
    "gestão de alunos personal trainer",
    "software personal trainer",
    "treinos online personal trainer",
    "controle de acesso aluno",
    "biblioteca de exercícios",
    "personal trainer SaaS",
  ],
  openGraph: {
    title: "Motion — Plataforma para Personal Trainers",
    description:
      "Organize alunos, treinos e biblioteca de exercícios em um só lugar. 7 dias grátis.",
    url: "https://www.motionpersonal.com.br",
    siteName: "Motion",
    images: [
      {
        url: "/images/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Motion — Plataforma para Personal Trainers",
      },
    ],
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Motion — Plataforma para Personal Trainers",
    description:
      "Organize alunos, treinos e biblioteca de exercícios em um só lugar. 7 dias grátis.",
    images: ["/images/twitter-image.jpg"],
  },
};
