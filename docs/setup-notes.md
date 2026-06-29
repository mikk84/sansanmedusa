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
| Medusa Admin panel | ✅ Renders + login works (see "Admin panel" below) |
| Storefront homepage / PLP / PDP | ✅ Wired to the live Medusa catalog (real products, prices, images) |
| Cart (drawer) + checkout (/kassa) | ✅ Real Medusa cart; order placed end-to-end (system payment, manual fulfillment) |
| Product migration from Magento | ✅ Done — 4,095 products, 139 categories, 26 vendors imported from SQL dump |
| Product images | ✅ Matched locally (4,094 products) + served at `/static`; R2 upload pending |
| `medusa build` (production) | ✅ Passes (backend + admin) |
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

## Admin panel: making it render under pnpm

The Medusa Admin is a Vite-bundled React SPA. pnpm's default isolated
`node_modules` hides Medusa's internal admin packages from Vite/Rollup (rooted
at `apps/backend`), causing a cascade of "Failed to resolve import" overlays and
blank renders. Three changes fixed the whole class:

1. **`pnpm-workspace.yaml` → `nodeLinker: hoisted`** — flat, npm-style
   `node_modules` so the bundler resolves `@medusajs/admin-shared`,
   `@medusajs/dashboard`, `@medusajs/draft-order/admin`, etc. This is the
   supported layout for Medusa + pnpm. **Applying it requires removing
   `node_modules` and reinstalling** — pnpm won't re-link from cache.
2. **Added `@medusajs/admin-sdk`** (backend dep) — the bundled `draft-order`
   admin extension imports `defineRouteConfig` from it; without it the admin's
   React tree threw silently and rendered a blank `#medusa` root.
3. **`tsconfig.json` → `moduleResolution: "Bundler"`** — so TypeScript resolves
   Medusa's package `exports` subpaths (`@medusajs/framework/http`, `/utils`,
   `/mikro-orm/migrations`). The `ts-node` block overrides back to
   CommonJS/Node for runtime config loading.

> **Gotcha — reinstalling deps breaks the running Next.js dev server.** Swapping
> `node_modules` (e.g. the `nodeLinker` change) under a live `next dev` makes
> webpack fail with `Can't resolve 'next-flight-client-entry-loader'` and routes
> 404. Fix: stop the storefront, `rm -rf apps/storefront/.next`, restart.

> **Known issue — `medusa build` fails type-check.** With `moduleResolution:
> bundler`, `tsc` now type-checks the backend modules and surfaces *real* type
> errors that dev mode (transpileOnly) skipped: montonio's
> `AbstractPaymentProvider` method signatures, a `MeiliSearch`→`Meilisearch`
> casing typo in the search module, some `unknown`-typed service resolutions,
> and a workflow return type. These don't affect `medusa develop` or the demo,
> but must be fixed before a production build. Tracked as a follow-up.

### Admin login (local)
`http://localhost:9000/app` — `mikk@mikk.ee` / `SanSan2024!`. First load after a
restart takes ~20–30s while Vite re-optimizes the dashboard dep graph, then it's
instant.

---

## Storefront subpages (PLP / PDP)

Built from the design handoff's `Alaleheküljed v2` frames, against the
placeholder catalog in `src/lib/sample-data.ts`:

- **`/kategooriad/[slug]`** — catalog grid (Frame 9). `CatalogView.tsx` holds the
  interactive filter sidebar (subcategory + price + brand), sort dropdown,
  removable filter chips, and pagination. Cards: `ProductCardPLP.tsx`.
- **`/tooted/[slug]`** — product detail (Frame 3). Server component for the
  static layout; `ProductBuyBlock.tsx` is the client island for size selection
  and the quantity stepper.

"Add to cart" buttons dispatch a `sansan:add-to-cart` window event for now; they
get wired to the real Medusa cart when checkout is built. Once products are
migrated, swap `sample-data.ts` calls for Medusa Store API queries — the
component props already match the eventual API shape.

---

## Product migration (done) — Magento SQL dump → Medusa

The catalog was imported from a **full Magento 1.9 MariaDB dump** rather than the
flat CSV — the SQL source preserves the EAV structure (attribute sets, option
labels, category tree) that a CSV flattens. Full step-by-step in
[product-migration.md](product-migration.md). Summary:

1. Load the gzipped dump (`scripts/data/*.sql.gz`, gitignored) into a throwaway
   MariaDB 11.4 container (`sansan-magento-import`, host port **3307**).
2. Run the importer: `pnpm exec medusa exec ./src/scripts/import-magento.ts`.
   It reads the Magento EAV tables via `mysql2` and creates everything through
   Medusa's native workflows (`createProductsWorkflow`,
   `createProductCategoriesWorkflow`) + the vendor module service.

**Result:** 4,095 enabled products (published), 139 categories (full parent
tree), 26 vendors (20 via_terminal / 6 dropship), ~14k category links. Each
product carries metadata: brand (`tootja`), vendor + vendor SKU, attribute set,
stock label, and all non-system attribute values — **purchase `cost` excluded**
so it can't leak to the storefront. Took ~13s for the full run.

### Gotchas hit during migration
- **Estonian characters dropped in descriptions.** Magento's WYSIWYG stored
  accented chars as HTML entities (`Kaubam&auml;rgist`). The first `stripHtml`
  blanked *all* entities, deleting ä/ö/ü (titles were fine — plain UTF-8). Fixed
  with a real entity **decoder** (named + numeric + `&shy;`/zero-width removal)
  that also strips Magento `{{media}}` directives. Re-import was clean.
- **Duplicate category handles.** The Magento tree reuses names (e.g.
  "Lisatarvikud" under several parents); Medusa requires unique handles, so the
  importer appends a numeric suffix on collision.
- **Re-running isn't idempotent for categories** (it would create suffixed
  duplicates). To re-import, clear products + categories first
  (`DELETE FROM product_category_product; DELETE FROM product_category;
  DELETE FROM product CASCADE;`) — vendors are matched by name and safe to keep.
- **mysql2** is a backend dependency purely for this importer.

### Images (matched locally; R2 pending)
The dump holds only image **paths** (`/f/i/file.jpg`), not the binaries. The
~9.8 GB of originals were `rsync`'d from the server (excluding the regenerable
`cache/`) into the gitignored `media/` folder. Then:

- `apps/backend/src/scripts/attach-images.ts` (run via `medusa exec`) reads each
  product's `magento_id`, looks up its base image + media gallery in MariaDB,
  verifies the local file, and sets the product's `thumbnail` + `images` to
  `${MEDUSA_BACKEND_URL}/static/catalog/product<path>`. Result: **4,094 / 4,095**
  products have images (1 had none in Magento), 0 missing files.
- Serving: `media/catalog` is symlinked into `apps/backend/static/catalog`
  (gitignored) and the local file module serves it at `/static`. **No 9.8 GB
  copy** — one source of truth.

The original 21 MB CSV export sits in `uploads/` (gitignored) as a fallback.

**Production TODO:** upload `media/` to Cloudflare R2 and switch the image URLs
from `localhost:9000/static/...` to `media.sansan.ee/...` (R2 env vars are
already stubbed in `.env`).

---

## Product detail (PDP) notes

- **Gallery** is interactive (`ProductGallery.tsx`, client) — base image + media
  gallery, click a thumbnail to swap the main image.
- **Attributes** are imported as a fully-resolved, labelled list
  (`metadata.attributes` = `[{ label, value, url? }]`) by `import-magento.ts`:
  multiselect option ids are resolved to labels (e.g. *Mõõt: 80×80, 90×90…*),
  HTML link attributes like *Paigaldusjuhend* surface the PDF href, and decimals
  are trimmed (`40.0000` → `40`). Supplier/cost/SEO/system codes are excluded;
  `tootja` shows as **Kaubamärk**. The PDP renders the whole list.
- **Long description** (Magento `description`) is shown in a "Toote kirjeldus"
  section below the fold.
- **Configurability comes from Magento "custom options", not configurable
  products.** No configurable products exist (`catalog_product_super_link` is
  empty), but **1,723 simple products carry custom options** (drop_down, radio,
  checkbox, field, area) with additive price deltas — that's how SanSan made
  products configurable. These are imported into `metadata.custom_options` and
  driven by a PDP **configurator** (see below). Sizes that are *only* in the
  *Mõõdud* text attribute (no custom option) still display as plain attributes.
- **Attribute frontend-visibility is honoured** — only attributes flagged
  `is_visible_on_front=1` in Magento (`catalog_eav_attribute`) are imported into
  `metadata.attributes` (e.g. Transpordikaal / Mõõt cm are hidden).

### Configurator (custom options)
- Import → `metadata.custom_options = [{ id, title, type, required, price,
  price_type, values:[{id,title,price,price_type}] }]`.
- PDP `ProductBuyBlock` renders selects/radios/checkboxes/text fields, computes
  a **live price** (base + deltas), and validates required options.
- Add-to-cart hits a custom store route **`POST /store/carts/:id/configure`**
  which recomputes the price **server-side** (anti-tamper) from the product
  metadata and adds a line item with a custom `unit_price` (via
  `addToCartWorkflow`, which keeps custom prices through cart refresh) plus the
  chosen options in `configured_options` metadata. The cart drawer + order show
  the selected options. Verified: Duschy Square 553 + 38 + 14 + 23 = **628 €**.

## Cart & checkout

- **Cart** is a real Medusa cart. `lib/store-client.ts` (browser) wraps the
  Store cart/checkout endpoints; `lib/cart-context.tsx` is a React provider
  (wrapped in `app/layout.tsx`) that creates/persists the cart id in
  `localStorage`, listens for the `sansan:add-to-cart` window event dispatched
  by product cards / PDP, and drives the header badge + drawer.
- **Checkout** (`/kassa`, `components/checkout/CheckoutClient.tsx`) collects
  contact + address, lists/selects a shipping option, then on submit:
  `updateCart` (email + address) → `addShippingMethod` → `initPaymentCollection`
  → `initPaymentSession` → `completeCart`, then shows an order confirmation and
  clears the cart. Verified end-to-end (order #1 placed).
- **Backend prerequisites** were created once by
  `src/scripts/checkout-setup.ts`: a stock location (linked to the sales channel
  + `manual_manual` fulfillment), a fulfillment set with an **Eesti** service
  zone, a flat-rate **"Kuller" 4.90 €** shipping option, and the
  `pp_system_default` payment provider linked to the Eesti region.
- **Payment is the demo system provider** (`pp_system_default`), which
  auto-authorizes so orders complete without a redirect. The real **Montonio**
  provider (module already scaffolded in `src/modules/montonio`) needs live
  credentials + a region link to replace it; the checkout UI already labels the
  method as Montonio.

## Storefront ↔ Medusa data layer

The homepage, PLP (`/kategooriad/[slug]`), and PDP (`/tooted/[slug]`) fetch from
the **Medusa Store API** via `apps/storefront/src/lib/medusa.ts` (server-side
`fetch`, publishable key in `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`). Notes:

- A **region** (Eesti / EUR) must exist for `calculated_price` to resolve —
  created via `POST /admin/regions`. Without it the store products endpoint
  returns no prices.
- `lib/medusa.ts` maps Store API responses to the same shapes the components
  already used (`sample-data.ts` types), converting Medusa's major-unit prices
  to **cents** so the existing components (which divide by 100) work unchanged.
- `sample-data.ts` is retained for its types and as an offline fallback.
- Image hosts must be allow-listed in `next.config.ts` (`localhost:9000` for
  local; add the R2 domain for production).

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
