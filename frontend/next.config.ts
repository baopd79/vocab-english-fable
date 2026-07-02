import type { NextConfig } from "next";

const API_PROXY_TARGET = process.env.API_PROXY_TARGET ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  images: {
    // Google profile avatars (lh3.googleusercontent.com, ...)
    remotePatterns: [{ protocol: "https", hostname: "*.googleusercontent.com" }],
  },
  async rewrites() {
    // Dev only: keeps FE/BE same-origin so httpOnly cookies work (SPEC §6.6).
    // In production Nginx routes /api before requests ever reach Next.js.
    return [{ source: "/api/:path*", destination: `${API_PROXY_TARGET}/api/:path*` }];
  },
};

export default nextConfig;
