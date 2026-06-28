# Setup Notes & Build Log

Real-world notes from standing up the project locally — the gotchas, why
certain files look the way they do, and the current state of each subsystem.
Read this if something doesn't behave as the other docs imply.

Last updated: 2026-06-28.

---

## Current status at a glance

| Area | State |
|---|---|
| Monorepo + workspaces | ✅ Done |
| Backend scaffold (Medusa v2) | ✅ Done |
| Database migrated (core + `vendor` table) | ✅ Done |
| Admin user created | ✅ `mikk@mikk.ee` (local) |
| All local services running | ✅ Postgres :5433, Redis :6379, Meilisearch :7700, API :9000, storefront :3000 |
| Storefront homepage | ✅ Pixel-matched to design, real logo |
| Storefront PLP / PDP / checkout | 🚧 In progress (built against sample data) |
| Product migration from Magento | ⏳ Waiting on the CSV at `scripts/data/catalog_product.csv` |
| Montonio / Resend live keys | ⏳ Placeholders in `.env` |

---

## Environment gotchas (resolved)

### Node.js must be 22.13+
pnpm v11 requires Node ≥ 22.13. Node 25 crashed during install
(`ERR_USE_AFTER_CLOSE`). **Use Node 22.** The repo pins it in `.nvmrc`.

```bash
brew install node@22
# Prefix commands when 22 isn't your default node:
PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm install
```

### pnpm native build approvals
pnpm blocks post-install build scripts by default. The allowed builds are
declared in `pnpm-workspace.yaml` under `allowBuilds` (esbuild, sharp,
msgpackr-extract, protobufjs, unrs-resolver). Without these the backend
won't boot.

### PostgreSQL port 5433
Host port 5432 was already taken by another project's container, so
`docker-compose.yml` maps Postgres to **5433** → `DATABASE_URL=...@localhost:5433/...`.

---

## Medusa config: why `medusa-config.js` (not `.ts`)

Medusa's CLI loads the config through `ts-node`. In this pnpm monorepo the
`.ts` config failed to resolve (`Cannot find module '.../medusa-config'`), and
`defineConfig` then choked introspecting custom modules. The working setup:

- Config is plain CommonJS: **`apps/backend/medusa-config.js`** (the old
  `medusa-config.ts` was removed).
- `@medusajs/framework` is a direct dependency of `apps/backend` so pnpm
  symlinks it where the CLI expects it.
- `ts-node` + `tsconfig-paths` are backend devDependencies; `tsconfig.json`
  has a `ts-node` block with `transpileOnly` + `ignore node_modules`.

### Custom modules need a generated migration
A custom module (e.g. `vendor`) is registered in `medusa-config.js`, but its
table is **not** created until you generate its migration:

```bash
pnpm exec medusa db:generate vendor   # writes src/modules/vendor/migrations/*
pnpm db:migrate                        # applies it
```

Also: **don't declare `created_at` / `updated_at`** in `model.define(...)` —
Medusa adds them (and `deleted_at`) implicitly. Declaring them throws
"Cannot define field(s) ... implicitly defined on every model".

### Migration script auth
`scripts/migrate-products.ts` authenticates by logging in with
`MEDUSA_ADMIN_EMAIL` / `MEDUSA_ADMIN_PASSWORD` from `.env` (POST
`/auth/user/emailpass`) and using the returned JWT — **not** a static API key.
A `sk_...` secret API key is a *Store* credential and is rejected by `/admin/*`.

---

## Storefront gotchas (resolved)

### Tailwind CSS v4 needs explicit wiring
Two things were missing and produced an **unstyled page** (theme tokens but
zero utility classes):

1. **`postcss.config.mjs`** registering `@tailwindcss/postcss` — without it
   `@import "tailwindcss"` passes through unprocessed.
2. **`@source "../../src";`** at the top of `globals.css` — Tailwind v4's
   automatic content detection infers the project root *above* the app in a
   pnpm monorepo and scans nothing, so no utilities are generated.

### `experimental.ppr` removed from `next.config.ts`
Partial Pre-Rendering is canary-only. On stable Next.js 15.3.x it crashes with
`CanaryOnlyError`. Re-enable only if/when we pin a Next canary build.

### Logo
The brand logo lives at `apps/storefront/public/logo.png` (943×756,
transparent red wordmark — the official asset from the design package's
`uploads/logo_general.png`). The header references `/logo.png`. If you replace
it, a hard reload is needed because Next's image optimizer caches by URL.

---

## Running everything locally

Services are also declared in `.claude/launch.json` (used by the preview
tooling), but the plain commands are:

```bash
# 1. Infra
docker compose up -d

# 2. Backend (from apps/backend) — API + Admin on :9000
PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm dev

# 3. Storefront (from apps/storefront) — :3000
PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm dev
```

> The Medusa admin dashboard (`/app`) is bundled with Vite and needs `react` /
> `react-dom`, which is why they're dependencies of `apps/backend` even though
> it's an API service.

---

## Design source of truth

The HTML/CSS design handoff lives in
`modern-sanitaryware-storefront-redesign/` (from claude.ai/design). The primary
file is `project/SanSan - Alaleheküljed v2.dc.html` — 11 frames covering
homepage, megamenu, PDP, minicart, catalog/PLP, smart search, and all mobile
variants. Storefront components are recreated pixel-for-pixel from these specs;
design tokens are mirrored in `globals.css`.
