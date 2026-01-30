// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ignora erros de TypeScript no build
  typescript: {
    ignoreBuildErrors: true,
  },

  // ignora erros do ESLint no build
  eslint: {
    ignoreDuringBuilds: true,
  },

  images: {
    // ✅ libera o host do Supabase (também funciona com domains)
    domains: ["wgonvfstqepffthzaugo.supabase.co"],

    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/dmw3vgmbv/**",
      },
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
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },

      // ✅ Supabase Storage (links públicos)
      {
        protocol: "https",
        hostname: "wgonvfstqepffthzaugo.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },

      // ✅ Supabase Image Renderer (às vezes aparece em algumas URLs)
      {
        protocol: "https",
        hostname: "wgonvfstqepffthzaugo.supabase.co",
        pathname: "/storage/v1/render/image/public/**",
      },
    ],
  },
};

export default nextConfig;
