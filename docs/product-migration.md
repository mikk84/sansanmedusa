# Product Migration — Magento → Medusa

## What gets migrated

| Data | Migrated | Notes |
|---|---|---|
| Products (4,099 SKUs) | ✅ | All simple products |
| Product names & descriptions | ✅ | HTML stripped to plain text |
| Prices & sale prices | ✅ | Converted to cents |
| Cost prices | ✅ | Stored in metadata (not shown to customers) |
| URL slugs (`url_key`) | ✅ | Preserved for SEO continuity |
| Brands (`tootja`) | ✅ | Stored in metadata |
| Vendors (`hankija`) | ✅ | Created as Vendor records |
| Vendor SKUs (`hankija_kood`) | ✅ | Stored in variant + metadata |
| Attribute sets | ✅ | Stored as product type + metadata |
| Custom attributes | ✅ | All non-system columns stored in metadata |
| Categories | ✅ | Full paths preserved as nested categories |
| Stock labels | ✅ | Text labels preserved (e.g. "Tellimisel 2-14 tööpäeva") |
| Product images | ⏳ | Migrated separately (see below) |
| Customer accounts | ❌ | Not migrating — fresh start |
| Order history | ❌ | Not migrating — fresh start |

## Prerequisites

1. Medusa backend is running and `db:migrate` has completed
2. At least one admin user exists in Medusa (created via `medusa user -e admin@sansan.ee -p password`)
3. You have a Medusa API key (create in Admin → Settings → API Keys)

## Steps

### 1. Place the CSV file

```bash
mkdir -p scripts/data
cp /path/to/catalog_product_20260628_121722.csv scripts/data/catalog_product.csv
```

> **Security note:** The CSV contains cost prices. It is gitignored (`scripts/data/`). Never commit it.

### 2. Run the migration

```bash
MEDUSA_API_KEY=your-api-key pnpm migrate
```

The script outputs a live progress counter and a final summary:

```
SanSan product migration
========================
CSV:    scripts/data/catalog_product.csv
Target: http://localhost:9000

Parsed 37655 CSV rows
Found 4099 products
Vendors: 26 created/found
Categories: 48 created/found
Importing 4099/4099...

── Results ──────────────────────────────────
  Imported: 4087
  Skipped:  12
  Errors:
    • SKU 12345: product title is required
```

The script is **safe to re-run** — it upserts by SKU.

### 3. Migrate product images

Images are served from the Magento media directory. After getting server access to Zone.ee:

```bash
# Option A: rsync from Zone.ee server
rsync -avz user@zone-server:/path/to/pub/media/catalog/product/ ./scripts/data/images/

# Option B: Download ZIP provided by client, extract to scripts/data/images/
```

Then upload to Cloudflare R2:

```bash
# Install rclone and configure R2 credentials
rclone copy scripts/data/images/ r2:sansan-media/catalog/product/ \
  --progress \
  --transfers=20
```

Update the `NEXT_PUBLIC_IMAGE_BASE_URL` env variable to point to R2.

### 4. Re-index Meilisearch

After import, trigger a full search re-index:

```bash
curl -X POST http://localhost:9000/admin/search/reindex \
  -H "Authorization: Bearer your-api-key"
```

### 5. Verify

```bash
# Check product count in Medusa
curl http://localhost:9000/store/products?limit=1 | jq '.count'
# Expected: 4099

# Check a specific product by original Magento URL key
curl "http://localhost:9000/store/products?handle=vihmaduss-schonberg-round-614" | jq '.products[0].title'
```

## Vendor fulfillment types

After migration, update vendor `fulfillment_type` in Admin → Vendors for vendors that aren't already mapped in the script. The script defaults unmapped vendors to `via_terminal`.

See [docs/oms-vendor-flow.md](oms-vendor-flow.md) for the full vendor list and mapping logic.

## Troubleshooting

**"product title is required" errors**
Products with empty `name` column in Magento. Check the original CSV and fix the product name, then re-run.

**Category not found**
Rarely happens if a category path contains special characters. Check `scripts/data/migration-errors.log` if it exists.

**Import is slow**
The script sends one API request per product. With 4,099 products and a local Medusa instance it takes ~8 minutes. Production import with a fast connection is ~3 minutes.
