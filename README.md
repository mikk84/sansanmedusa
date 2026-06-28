# SanSan — Modern Sanitaryware Storefront

Replacing Magento 1.9.4.5 with a modern, fully-owned e-commerce platform.

- **Frontend:** Next.js 15 (App Router, TypeScript, Tailwind CSS)
- **Backend / OMS:** Medusa.js v2 (Node.js, PostgreSQL)
- **Search:** Meilisearch
- **Payments:** Montonio (Estonian bank links, cards, hire purchase)
- **Email:** Resend
- **Images:** Cloudflare R2

---

## Repository structure

```
sansanmedusa/
├── apps/
│   ├── storefront/          # Next.js 15 customer-facing store
│   └── backend/             # Medusa v2 API + Admin + OMS
├── packages/
│   └── shared/              # Shared TypeScript types between apps
├── scripts/
│   └── migrate-products.ts  # One-time Magento CSV → Medusa import
├── docs/
│   ├── architecture.md      # System design & component overview
│   ├── oms-vendor-flow.md   # Order management & vendor email flow
│   ├── product-migration.md # How to run the Magento data migration
│   └── development.md       # Local dev setup guide
├── .env.example             # All environment variables documented
├── pnpm-workspace.yaml
└── turbo.json
```

---

## Quick start (local development)

### Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | **22.13+** | pnpm v11 requires ≥22.13. Repo pins `22` in `.nvmrc`. On macOS: `brew install node@22` |
| pnpm | 11+ | |
| PostgreSQL | 15+ | Docker maps it to host port **5433** (5432 left free for other projects) |
| Redis | 7+ | |
| Meilisearch | 1.7+ | |

### 1. Clone & install

```bash
git clone git@github.com:mikk84/sansanmedusa.git
cd sansanmedusa
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — at minimum set DATABASE_URL and REDIS_URL
```

### 3. Start services (Docker optional)

```bash
# PostgreSQL + Redis + Meilisearch via Docker Compose:
docker compose up -d

# Or use local installations — see docs/development.md
```

### 4. Set up the database

```bash
cd apps/backend

# Generate the migration for the custom vendor module (first time only)
pnpm exec medusa db:generate vendor

# Run all migrations (core Medusa modules + vendor)
pnpm db:migrate

# Create an admin user for the dashboard
pnpm exec medusa user --email you@sansan.ee --password YourPassword123
```

> **Note:** custom Medusa modules need their migration generated with
> `db:generate <module>` before `db:migrate` will create their tables.
> See [docs/setup-notes.md](docs/setup-notes.md) for the gotchas we hit.

### 5. Start development servers

```bash
# From root — starts both storefront and backend concurrently
pnpm dev
```

| Service | URL |
|---|---|
| Storefront | http://localhost:3000 |
| Medusa API | http://localhost:9000 |
| Medusa Admin | http://localhost:9000/app |
| Meilisearch | http://localhost:7700 |

---

## Importing products from Magento

See [docs/product-migration.md](docs/product-migration.md) for the full guide.

```bash
# Quick run (backend must be running; the script logs in with the admin
# credentials from .env — MEDUSA_ADMIN_EMAIL / MEDUSA_ADMIN_PASSWORD):
cp /path/to/catalog_product.csv scripts/data/catalog_product.csv
pnpm migrate
```

---

## Documentation

| Document | Description |
|---|---|
| [Architecture](docs/architecture.md) | System overview, component diagram, technology choices |
| [OMS & Vendor flow](docs/oms-vendor-flow.md) | How orders are routed to vendors, dropship vs terminal |
| [Product migration](docs/product-migration.md) | Running the Magento CSV import |
| [Development guide](docs/development.md) | Local setup, environment variables, common commands |
| [Setup notes & build log](docs/setup-notes.md) | Gotchas, current status, why certain files look the way they do |

---

## Key design decisions

**Why Medusa v2?**
Gives us a production-ready Admin panel, order management system, and extensible fulfillment model — without building those from scratch. The custom vendor module on top handles SanSan's hybrid dropship + via-terminal model.

**Why Montonio?**
The only payment provider with native support for all three Baltic bank link networks, card payments, and Estonian hire-purchase (järelmaks via Inbank, Esto, LHV) in a single integration.

**Why Meilisearch?**
Typo-tolerant full-text search with faceted filtering in <50ms. Self-hosted, free, runs on the same VPS. 4,099 products fits comfortably in its default index.

**Why pnpm + Turborepo?**
Monorepo tooling that shares dependencies, runs tasks in parallel, and caches build outputs. Both apps share the `@sansanmedusa/shared` package for TypeScript types.
