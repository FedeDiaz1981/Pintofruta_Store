import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1", "localhost", "172.31.64.1"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "tjdbblgyyfmrxwduoyti.supabase.co",
        pathname: "/**",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
