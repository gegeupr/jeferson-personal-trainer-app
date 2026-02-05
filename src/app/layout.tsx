import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Motion",
    template: "%s | Motion",
  },

  description: "Gestão inteligente para personal trainers",

  applicationName: "Motion",

  keywords: [
    "personal trainer",
    "treino online",
    "consultoria fitness",
    "app de treino",
    "musculação",
    "reabilitação",
    "funcional",
  ],

  authors: [
    {
      name: "Jeferson Parowski",
      url: "https://motionpersonal.com.br",
    },
  ],

  creator: "Jeferson Parowski",

  themeColor: "#00FF88",

  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },

  manifest: "/site.webmanifest", // opcional

  openGraph: {
    title: "Motion",
    description: "Gestão inteligente para personal trainers",
    siteName: "Motion",
    locale: "pt_BR",
    type: "website",
  },

  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head />

      <body
        className={`${inter.className} bg-black text-white antialiased min-h-screen`}
      >
        {children}
      </body>
    </html>
  );
}

