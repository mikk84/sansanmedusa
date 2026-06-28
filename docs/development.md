# Development Guide

## First-time setup

### 1. Install dependencies

```bash
# Install pnpm if you don't have it
npm install -g pnpm

# Install all workspace dependencies
pnpm install
```

### 2. Set up local services

#### Option A: Docker (recommended)

```bash
docker compose up -d
```

This starts PostgreSQL 16, Redis 7, and Meilisearch 1.7 locally.

#### Option B: Native installations (macOS)

```bash
brew install postgresql@16 redis meilisearch
brew services start postgresql@16
brew services start redis
meilisearch --master-key=local-dev-key &
```

### 3. Configure environment

```bash
cp .env.example .env
```

Minimum required values for local development (the Docker Compose stack maps
Postgres to host port **5433**):

```env
DATABASE_URL=postgresql://sansan:sansan_dev@localhost:5433/sansan_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=local-dev-jwt-secret-minimum-32-chars
COOKIE_SECRET=local-dev-cookie-secret-32-chars
MEILISEARCH_API_KEY=local-dev-key
RESEND_API_KEY=re_xxxx          # Get from resend.com (free tier works)
MONTONIO_ACCESS_KEY=sandbox-key  # Get from Montonio merchant portal
MONTONIO_SECRET_KEY=sandbox-key
MONTONIO_ENVIRONMENT=sandbox

# Used by scripts/migrate-products.ts to authenticate against /admin
MEDUSA_ADMIN_EMAIL=you@sansan.ee
MEDUSA_ADMIN_PASSWORD=YourPassword123
```

### 4. Initialize the database

```bash
cd apps/backend

# Generate the vendor module migration (first time only), then migrate
pnpm exec medusa db:generate vendor
pnpm db:migrate

# Create your admin user
pnpm exec medusa user --email you@sansan.ee --password YourPassword123
```

> See [setup-notes.md](setup-notes.md) for why custom modules need
> `db:generate` first, and other environment gotchas.

### 5. Start development

```bash
# From the repo root — starts both apps with hot reload
pnpm dev
```

| Service | URL | Description |
|---|---|---|
| Storefront | http://localhost:3000 | Customer-facing shop |
| Medusa API | http://localhost:9000 | REST API |
| Medusa Admin | http://localhost:9000/app | Staff admin panel |
| Meilisearch | http://localhost:7700 | Search engine dashboard |

---

## Common development commands

```bash
# Start all services
pnpm dev

# Build everything (checks for type errors)
pnpm build

# Type-check without building
pnpm type-check

# Lint all workspaces
pnpm lint

# Run product migration (backend must be running; auth via .env admin creds)
pnpm migrate

# Run only the storefront
cd apps/storefront && pnpm dev

# Run only the backend
cd apps/backend && pnpm dev
```

---

## Project structure deep-dive

### Backend (`apps/backend/src/`)

```
src/
├── modules/
│   ├── vendor/          # Custom vendor model & service
│   │   ├── models/vendor.ts      — Vendor entity (id, name, email, fulfillment_type)
│   │   ├── services/             — VendorModuleService (CRUD)
│   │   └── index.ts              — Module registration
│   ├── montonio/        # Montonio payment provider
│   │   ├── service.ts            — AbstractPaymentProvider implementation
│   │   └── index.ts
│   ├── invoice/         # Invoice PDF generation + email
│   │   ├── service.ts            — generateAndSend(), buildInvoiceHtml()
│   │   └── index.ts
│   └── search/          # Meilisearch integration
│       ├── service.ts            — indexProduct(), search()
│       └── index.ts
├── workflows/
│   └── notify-vendors.ts  # Vendor email workflow (groupItemsByVendor + sendVendorEmails)
├── subscribers/
│   └── order-placed.ts    # Listens for order.placed, triggers notify-vendors workflow
└── api/
    ├── admin/
    │   └── vendors/       # GET/POST /admin/vendors, GET/PUT/DELETE /admin/vendors/:id
    └── hooks/
        └── payment/
            └── montonio/  # POST /hooks/payment/montonio (webhook)
```

### Storefront (`apps/storefront/src/`)

```
src/
├── app/                   # Next.js App Router pages
│   ├── layout.tsx         — Root layout (DM Sans font, metadata)
│   ├── page.tsx           — Homepage (hero + categories + featured products)
│   ├── tooted/[slug]/     — Product detail page (PDP)
│   ├── kategooriad/       — Category listing pages
│   ├── otsing/            — Search results page
│   └── kassa/             — Checkout flow
├── components/
│   ├── layout/
│   │   ├── Header.tsx     — Announcement bar + logo + nav
│   │   └── MegaMenu.tsx   — Full-width category dropdown
│   ├── product/
│   │   └── ProductCard.tsx — Reusable product card (grid + list variants)
│   ├── cart/
│   │   └── CartDrawer.tsx  — Slide-in cart drawer
│   └── ui/
│       └── SearchBar.tsx   — Search input with Meilisearch integration
├── lib/
│   ├── medusa.ts          — Medusa JS SDK client
│   └── search.ts          — Meilisearch client + helpers
└── hooks/
    └── useCart.ts         — Cart state (React context)
```

---

## Adding a new page

1. Create `apps/storefront/src/app/your-page/page.tsx`
2. Export a default async React Server Component
3. Fetch data from Medusa using `lib/medusa.ts` helpers
4. Use existing layout components (`<Header />`, etc.)

## Adding a new Medusa module

1. Create `apps/backend/src/modules/your-module/`
2. Define a model in `models/`
3. Create a service extending `MedusaService`
4. Export via `index.ts` with `Module()`
5. Register in `medusa-config.ts`
6. Run `pnpm db:migrate`

---

## Deployment

See the hosting plan below. For production deployment:

```bash
# Build everything
pnpm build

# Backend: start with PM2 or Docker
cd apps/backend && pnpm start

# Storefront: deploy to Vercel
cd apps/storefront && vercel --prod
```

## Infrastructure (production)

| Service | Provider | Approx. cost |
|---|---|---|
| Backend (Medusa + PostgreSQL + Redis + Meilisearch) | Hetzner CX22 | €4/month |
| Storefront | Vercel Hobby | Free / €20 pro |
| Product images | Cloudflare R2 | ~€5/month |
| Transactional email | Resend | Free up to 3k/month |
| Domain | Existing | — |
| **Total** | | **~€30–50/month** |
