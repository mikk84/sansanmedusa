const { loadEnv, defineConfig } = require("@medusajs/framework/utils")

loadEnv(process.env.NODE_ENV || "development", process.cwd())

module.exports = defineConfig({
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
    // Custom vendor module — creates the 'vendor' table in postgres
    { resolve: "./src/modules/vendor" },
    // Invoice generation + email (Resend). Called from the order.placed subscriber.
    { resolve: "./src/modules/invoice" },
    // Meilisearch product index. Populated by the product subscriber + reindex script.
    {
      resolve: "./src/modules/search",
      options: {
        host: process.env.MEILISEARCH_HOST || "http://localhost:7700",
        apiKey: process.env.MEILISEARCH_API_KEY || "",
      },
    },
    // Payment: system provider (demo) + Montonio (Estonian bank links / card /
    // järelmaks). Montonio needs real credentials + webhook hardening before
    // it can go live (remediation #29); it is registered here as provider
    // pp_montonio_montonio but the demo checkout still uses pp_system_default.
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [
          {
            resolve: "./src/modules/montonio",
            id: "montonio",
            options: {
              accessKey: process.env.MONTONIO_ACCESS_KEY,
              secretKey: process.env.MONTONIO_SECRET_KEY,
              environment: process.env.MONTONIO_ENVIRONMENT || "sandbox",
            },
          },
        ],
      },
    },
    // Local file storage — serves files from ./static at /static.
    // The migrated Magento images are symlinked in at static/catalog
    // (apps/backend/static/catalog → ../../media/catalog). Production will
    // swap this for the S3/R2 provider.
    {
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/file-local",
            id: "local",
            options: {
              upload_dir: "static",
              backend_url: `${process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"}/static`,
            },
          },
        ],
      },
    },
  ],
})
