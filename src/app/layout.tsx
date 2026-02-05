import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

// ✅ No App Router, themeColor e viewport ficam aqui:
export const viewport: Viewport = {
  themeColor: "#00FF88",
  width: "device-width",
  initialScale: 1,
};

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

  // ✅ Seu manifest agora é o novo nome:
  manifest: "/manifest.webmanifest",

  // ✅ Ícones completos (PWA + navegador + iOS)
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico" },
      { url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} bg-black text-white antialiased min-h-screen`}>
        {children}
      </body>
    </html>
  );
}