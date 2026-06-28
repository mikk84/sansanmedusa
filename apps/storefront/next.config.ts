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
  // NOTE: experimental.ppr (Partial Pre-Rendering) requires a Next.js canary
  // build. Re-enable once we pin a canary version. Running on stable 15.3.3.
}

export default nextConfig
