import { loadEnv, defineConfig, Modules } from "@medusajs/framework/utils"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

export default defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS || "http://localhost:3000",
      adminCors: process.env.ADMIN_CORS || "http://localhost:9000",
      authCors: process.env.AUTH_CORS || "http://localhost:9000",
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    },
  },
  admin: {
    backendUrl: process.env.MEDUSA_BACKEND_URL || "http://localhost:9000",
  },
  modules: [
    // ── File storage: local dev, swap to R2 in production ──────────
    {
      resolve: "@medusajs/file-local",
      options: {
        upload_dir: "uploads",
        backend_url: process.env.MEDUSA_BACKEND_URL || "http://localhost:9000",
      },
    },
    // ── Manual fulfillment (base — extended by our vendor module) ───
    {
      resolve: "@medusajs/fulfillment-manual",
    },
    // ── Custom: Vendor + dropship OMS ──────────────────────────────
    {
      resolve: "./src/modules/vendor",
    },
    // ── Custom: Invoice PDF generation ─────────────────────────────
    {
      resolve: "./src/modules/invoice",
    },
    // ── Custom: Montonio payment provider ──────────────────────────
    {
      resolve: "./src/modules/montonio",
      options: {
        accessKey: process.env.MONTONIO_ACCESS_KEY,
        secretKey: process.env.MONTONIO_SECRET_KEY,
        environment: process.env.MONTONIO_ENVIRONMENT || "sandbox",
      },
    },
    // ── Search: Meilisearch ────────────────────────────────────────
    {
      resolve: "./src/modules/search",
      options: {
        host: process.env.MEILISEARCH_HOST || "http://localhost:7700",
        apiKey: process.env.MEILISEARCH_API_KEY,
      },
    },
  ],
})
