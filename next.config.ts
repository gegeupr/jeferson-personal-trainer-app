// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build mais permissivo (se quiser mais rigor depois, a gente volta)
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  // ✅ Imagens
  images: {
    // Se você usa <Image> para URLs externas, libere aqui.
    // (domains é mais simples; remotePatterns é mais completo)
    domains: [
      "wgonvfstqepffthzaugo.supabase.co",
      "res.cloudinary.com",
      "i.ytimg.com",
      "s.ytimg.com",
      "lh3.googleusercontent.com",
    ],

    remotePatterns: [
      // ✅ Supabase Storage - links públicos
      {
        protocol: "https",
        hostname: "wgonvfstqepffthzaugo.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },

      // ✅ Supabase "render/image" (às vezes aparece dependendo do link)
      {
        protocol: "https",
        hostname: "wgonvfstqepffthzaugo.supabase.co",
        pathname: "/storage/v1/render/image/public/**",
      },

      // ✅ Cloudinary (público)
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },

      // ✅ YouTube thumbs
      {
        protocol: "https",
        hostname: "i.ytimg.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "s.ytimg.com",
        pathname: "/**",
      },

      // ✅ Google avatars
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
    ],

    // ✅ dica: formatos modernos (melhora performance quando o otimizador funciona)
    formats: ["image/avif", "image/webp"],

    // ✅ evitar “alertas” bobos e protege memória
    minimumCacheTTL: 60,
  },

  // ✅ Headers (opcional, mas ajuda com imagens/cache)
  async headers() {
    return [
      {
        // Cache forte para assets do Next (logo, css, js etc)
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
