# Product Migration — Magento → Medusa

The catalog is migrated from a **full Magento 1.9 MariaDB dump** (not the flat
CSV). The SQL source preserves the Magento EAV structure — attribute sets,
option labels, and the category tree — which a CSV export flattens or drops.

The importer is a Medusa `exec` script:
[`apps/backend/src/scripts/import-magento.ts`](../apps/backend/src/scripts/import-magento.ts).
It reads the Magento tables from a throwaway MariaDB container via `mysql2` and
creates everything through Medusa's native workflows (so price sets, sales
channels, inventory, and category hierarchy are all handled correctly).

> The older CSV-based script (`scripts/migrate-products.ts`) is superseded by
> this DB importer and kept only for reference.

## What gets migrated

| Data | Migrated | Notes |
|---|---|---|
| Products (4,095 enabled) | ✅ | `simple` products with `status = 1`; published in Medusa |
| Disabled products (2,229) | ❌ | Skipped (decision: enabled only) |
| Names | ✅ | Plain UTF-8, preserved verbatim |
| Descriptions / short descriptions | ✅ | HTML stripped, entities **decoded** (see gotcha below) |
| Prices & sale prices | ✅ | Decimal EUR (Medusa v2 stores major units, not cents) |
| Cost prices (`cost`) | ❌ | **Deliberately excluded** — never exposed to the storefront |
| URL slugs (`url_key`) | ✅ | Used as the product `handle` (SEO continuity) |
| Brands (`tootja` / "Kaubamärk") | ✅ | Option label resolved → `metadata.brand` |
| Vendors (`hankija`) | ✅ | Created as Vendor records (28 options → 26 used) |
| Vendor SKUs (`hankija_kood`) | ✅ | `metadata.vendor_sku` |
| Attribute sets | ✅ | `metadata.attribute_set` (e.g. "Segistid", "Vannid") |
| Custom attributes | ✅ | All non-system values → `metadata` (select labels resolved) |
| Categories (~140) | ✅ | Full parent tree preserved; ~14k product links |
| Stock labels | ✅ | `metadata.stock_label` (e.g. "Tellimisel 2-14 tööpäeva") |
| Product images | ⏳ | Separate step — dump has only paths, not files (see below) |
| Customers / orders | ❌ | Not migrating — fresh start |

## Prerequisites

1. Docker running; Medusa backend migrated (`pnpm db:migrate`) with an admin user.
2. The gzipped dump placed at `scripts/data/*.sql.gz` (gitignored — contains
   cost prices, never commit).

## Steps

### 1. Load the dump into a throwaway MariaDB

```bash
# start a disposable MariaDB (host port 3307 to avoid clashes)
docker run -d --name sansan-magento-import \
  -e MARIADB_ROOT_PASSWORD=root -e MARIADB_DATABASE=magento \
  -p 3307:3306 mariadb:11.4

# wait until ready, then load (~2GB uncompressed, ~1 min)
gzip -dc scripts/data/magento.sql.gz \
  | docker exec -i sansan-magento-import mariadb -uroot -proot magento
```

### 2. Run the importer

```bash
cd apps/backend
# validate on a small batch first (optional)
MAGENTO_LIMIT=5 pnpm exec medusa exec ./src/scripts/import-magento.ts
# full run
pnpm exec medusa exec ./src/scripts/import-magento.ts
```

Connection + behaviour is controlled by env vars (defaults in the script):
`MAGENTO_DB_HOST=127.0.0.1`, `MAGENTO_DB_PORT=3307`, `MAGENTO_DB_USER=root`,
`MAGENTO_DB_PASSWORD=root`, `MAGENTO_DB_NAME=magento`, `MAGENTO_LIMIT=0` (0 = all).

Expected tail:
```
Magento import — 139 categories ready
Magento import — 26 vendors ready
Magento import — 4095 products created
Magento import — DONE. Created 4095, skipped 0, batch errors 0
```

The importer **skips products whose SKU already exists**, so a plain re-run only
adds new products.

### 3. Re-importing from scratch

Category creation is **not** idempotent (a re-run would create suffixed
duplicate categories). To do a clean re-import, clear products + categories first
(vendors are matched by name and safe to keep):

```bash
PGPASSWORD=sansan_dev psql -h localhost -p 5433 -U sansan -d sansan_db -c "
  DELETE FROM product_category_product;
  DELETE FROM product_category;
  DELETE FROM product CASCADE;"
```

### 4. Product images (pending)

The dump stores only image **paths** (`/f/i/file.jpg`), not the binaries. The
~9.8 GB of originals live on the Zone.ee server (excluding the regenerable
`cache/` folder):

```bash
rsync -avz --partial --progress --exclude='cache/' \
  -e "ssh -i ~/.ssh/<key>" \
  <user>@sansan.ee:<magento_root>/media/catalog/product/ \
  ./media/catalog/product/      # gitignored
```

Then match files to products by the stored paths and upload to Cloudflare R2
(production image host, served from `media.sansan.ee`).

### 5. Verify

```bash
# product / category / vendor counts straight from Postgres
PGPASSWORD=sansan_dev psql -h localhost -p 5433 -U sansan -d sansan_db -c "
  SELECT (SELECT count(*) FROM product) products,
         (SELECT count(*) FROM product_category) categories,
         (SELECT count(*) FROM vendor) vendors;"
```

In the Admin (`http://localhost:9000/app/products`) the catalog appears under
Products, and the tree under Products → Categories.

## Vendor fulfillment types

The importer sets `fulfillment_type` from the `DROPSHIP_VENDORS` set in the
script (everything else defaults to `via_terminal`). Adjust per-vendor in Admin →
Vendors, or update the set and re-run. See
[oms-vendor-flow.md](oms-vendor-flow.md) for the routing logic.

## Gotchas

**Estonian characters missing from descriptions.** Magento's WYSIWYG stored
accented chars as HTML entities (`Kaubam&auml;rgist`). The first `stripHtml`
blanked all entities, deleting ä/ö/ü (titles were unaffected — plain UTF-8). The
importer now **decodes** entities (named + numeric, drops `&shy;`/zero-width) and
strips `{{media}}` directives. If you change `stripHtml`, re-import to apply.

**Duplicate category handle errors.** The Magento tree reuses category names; the
importer makes handles globally unique with a numeric suffix on collision.

**Throwaway DB cleanup.** When done, `docker rm -f sansan-magento-import` frees
the container (and ~2 GB).
