import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Cloudflare R2 — production images
      {
        protocol: "https",
        hostname: "media.sansan.ee",
      },
      // Local Medusa file uploads — development
      {
        protocol: "http",
        hostname: "localhost",
        port: "9000",
      },
    ],
  },
  experimental: {
    // Partial pre-rendering for product pages (Next.js 15)
    ppr: true,
  },
}

export default nextConfig
