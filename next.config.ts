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
    // ✅ resolve na lata em alguns casos
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
      {
        protocol: "https",
        hostname: "wgonvfstqepffthzaugo.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },
};

export default nextConfig;
