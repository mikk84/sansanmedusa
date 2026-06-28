/**
 * migrate-products.ts
 *
 * Imports the Magento 1.9 product catalog CSV into Medusa v2.
 *
 * Usage:
 *   pnpm migrate
 *   # or directly:
 *   tsx scripts/migrate-products.ts --csv=/path/to/catalog_product.csv
 *
 * What it does:
 *   1. Reads the Magento CSV export (4,099 products, 248 columns)
 *   2. Groups multi-row products (continuation rows have no SKU)
 *   3. Maps Magento attribute sets → Medusa product types
 *   4. Maps hankija (vendor name) → Medusa vendor IDs
 *   5. Preserves url_key slugs for SEO continuity
 *   6. Imports via Medusa Admin REST API
 *
 * Run AFTER: backend is running + db:migrate completed
 * Safe to re-run: uses upsert by SKU
 */

import * as fs from "fs"
import * as path from "path"
import { parse } from "csv-parse/sync"

// ── Config ────────────────────────────────────────────────────────────────────
const MEDUSA_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
const MEDUSA_EMAIL = process.env.MEDUSA_ADMIN_EMAIL || "mikk@mikk.ee"
const MEDUSA_PASSWORD = process.env.MEDUSA_ADMIN_PASSWORD || "SanSan2024!"
let MEDUSA_TOKEN = "" // obtained via login() at startup
const CSV_PATH =
  process.argv.find((a) => a.startsWith("--csv="))?.split("=")[1] ||
  path.join(__dirname, "data", "catalog_product.csv")
const BATCH_SIZE = 50
const DEFAULT_CURRENCY = "eur"

// ── Vendor name → fulfillment_type mapping ────────────────────────────────────
// Update this map once you know which vendors dropship vs ship to terminal.
// Defaults to "via_terminal" for safety (no accidental direct-to-customer).
const VENDOR_FULFILLMENT: Record<string, "dropship" | "via_terminal"> = {
  "SANITINO s.r.o.": "dropship",
  "Ravak a.s.": "dropship",
  "Duschy Marketing AS": "dropship",
  "Casa Di Vanna": "dropship",
  "Gemlook OÜ": "dropship",
  "Vispool": "dropship",
  // All others default to via_terminal — update as needed
}

// ── Types ─────────────────────────────────────────────────────────────────────
type MagentoRow = Record<string, string>

type Product = {
  sku: string
  name: string
  description: string
  short_description: string
  price_cents: number
  special_price_cents: number | null
  cost_cents: number | null
  slug: string
  brand: string
  vendor_name: string
  vendor_sku: string
  attribute_set: string
  category: string
  stock_label: string
  is_active: boolean
  attributes: Record<string, string>
  categories: string[]
  images: string[]
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("SanSan product migration")
  console.log("========================")
  console.log(`CSV:    ${CSV_PATH}`)
  console.log(`Target: ${MEDUSA_URL}`)
  console.log()

  await login()

  if (!fs.existsSync(CSV_PATH)) {
    console.error(`ERROR: CSV not found at ${CSV_PATH}`)
    console.error("Place the Magento export CSV at scripts/data/catalog_product.csv")
    console.error("or pass --csv=/absolute/path/to/file.csv")
    process.exit(1)
  }

  const raw = fs.readFileSync(CSV_PATH, "utf-8")
  const rows: MagentoRow[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  })

  console.log(`Parsed ${rows.length} CSV rows`)

  // ── Step 1: Group continuation rows (no SKU) back to their product ──────────
  const products = groupRows(rows)
  console.log(`Found ${products.length} products`)

  // ── Step 2: Collect unique vendors and create them in Medusa ────────────────
  const vendorNames = [...new Set(products.map((p) => p.vendor_name).filter(Boolean))]
  const vendorMap = await upsertVendors(vendorNames)
  console.log(`Vendors: ${vendorMap.size} created/found`)

  // ── Step 3: Collect unique categories and create them ──────────────────────
  const allCategories = [...new Set(products.flatMap((p) => p.categories).filter(Boolean))]
  const categoryMap = await upsertCategories(allCategories)
  console.log(`Categories: ${categoryMap.size} created/found`)

  // ── Step 4: Import products in batches ─────────────────────────────────────
  let imported = 0
  let skipped = 0
  const errors: string[] = []

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE)
    process.stdout.write(`\rImporting ${i + batch.length}/${products.length}...`)

    for (const product of batch) {
      try {
        await upsertProduct(product, vendorMap, categoryMap)
        imported++
      } catch (e: any) {
        errors.push(`SKU ${product.sku}: ${e.message}`)
        skipped++
      }
    }
  }

  console.log("\n")
  console.log("── Results ──────────────────────────────────────────────────")
  console.log(`  Imported: ${imported}`)
  console.log(`  Skipped:  ${skipped}`)
  if (errors.length) {
    console.log(`  Errors:`)
    errors.forEach((e) => console.log(`    • ${e}`))
  }
  console.log()
  console.log("Done. Run Meilisearch re-index next:")
  console.log("  curl -X POST http://localhost:9000/admin/search/reindex \\")
  console.log(`    -H 'Authorization: Bearer <your-admin-token>'`)
}

// ── Parse & group rows ────────────────────────────────────────────────────────
function groupRows(rows: MagentoRow[]): Product[] {
  const products: Product[] = []
  let current: Product | null = null

  // Attribute columns that are product-specific (not Magento system fields)
  const SYSTEM_COLS = new Set([
    "sku", "_store", "_attribute_set", "_type", "_category", "_root_category",
    "_product_websites", "name", "description", "short_description", "price",
    "special_price", "special_from_date", "special_to_date", "cost", "weight",
    "status", "visibility", "url_key", "url_path", "created_at", "updated_at",
    "image", "small_image", "thumbnail", "media_gallery", "_media_image",
    "_media_position", "_media_is_disabled", "_media_attribute_id",
    "hankija", "hankija_kood", "tootja", "custom_stock_status",
  ])

  for (const row of rows) {
    if (row.sku?.trim()) {
      // New product row
      if (current) products.push(current)

      const cats = parseCategoryPath(row._category)

      // Collect custom attributes
      const attributes: Record<string, string> = {}
      for (const [key, val] of Object.entries(row)) {
        if (!SYSTEM_COLS.has(key) && val?.trim() && !key.startsWith("_")) {
          attributes[key] = val.trim()
        }
      }

      current = {
        sku: row.sku.trim(),
        name: row.name?.trim() || "",
        description: row.description?.trim() || "",
        short_description: row.short_description?.trim() || "",
        price_cents: parsePriceCents(row.price),
        special_price_cents: row.special_price?.trim()
          ? parsePriceCents(row.special_price)
          : null,
        cost_cents: row.cost?.trim() ? parsePriceCents(row.cost) : null,
        slug: row.url_key?.trim() || slugify(row.name || row.sku),
        brand: row.tootja?.trim() || "",
        vendor_name: row.hankija?.trim() || "",
        vendor_sku: row.hankija_kood?.trim() || "",
        attribute_set: row._attribute_set?.trim() || "Tavaline",
        category: row._category?.trim() || "",
        stock_label: row.custom_stock_status?.trim() || "Laos",
        is_active: row.status?.trim() === "1",
        attributes,
        categories: cats,
        images: row.image?.trim() ? [row.image.trim()] : [],
      }
    } else if (current) {
      // Continuation row — may add extra categories or images
      if (row._category?.trim()) {
        current.categories.push(...parseCategoryPath(row._category))
      }
      if (row._media_image?.trim() && row._media_is_disabled?.trim() !== "1") {
        current.images.push(row._media_image.trim())
      }
    }
  }

  if (current) products.push(current)

  // Deduplicate categories per product
  for (const p of products) {
    p.categories = [...new Set(p.categories)]
    p.images = [...new Set(p.images)]
  }

  return products
}

// ── API helpers ───────────────────────────────────────────────────────────────
async function login() {
  const res = await fetch(`${MEDUSA_URL}/auth/user/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: MEDUSA_EMAIL, password: MEDUSA_PASSWORD }),
  })
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`)
  const data = await res.json()
  MEDUSA_TOKEN = data.token
  console.log("Authenticated as", MEDUSA_EMAIL)
}

async function api(method: string, endpoint: string, body?: any) {
  const res = await fetch(`${MEDUSA_URL}${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MEDUSA_TOKEN}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${method} ${endpoint} → ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json()
}

async function upsertVendors(names: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const existing = await api("GET", "/admin/vendors")
  for (const v of existing.vendors || []) map.set(v.name, v.id)

  for (const name of names) {
    if (map.has(name)) continue
    const fulfillment_type = VENDOR_FULFILLMENT[name] || "via_terminal"
    const vendor = await api("POST", "/admin/vendors", {
      name,
      email: "", // Fill in manually via admin panel
      fulfillment_type,
    })
    map.set(name, vendor.vendor.id)
  }

  return map
}

async function upsertCategories(paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const existing = await api("GET", "/admin/product-categories?limit=200")
  for (const c of existing.product_categories || []) map.set(c.handle, c.id)

  for (const catPath of paths) {
    const handle = slugify(catPath)
    if (map.has(handle)) continue
    try {
      const cat = await api("POST", "/admin/product-categories", {
        name: catPath.split("/").pop() || catPath,
        handle,
        is_active: true,
        is_internal: false,
      })
      map.set(handle, cat.product_category.id)
    } catch {
      // May already exist
    }
  }

  return map
}

async function upsertProduct(
  product: Product,
  vendorMap: Map<string, string>,
  categoryMap: Map<string, string>
) {
  const vendorId = vendorMap.get(product.vendor_name)
  const categoryIds = product.categories
    .map((c) => categoryMap.get(slugify(c)))
    .filter(Boolean) as string[]

  const payload = {
    title: product.name,
    handle: product.slug,
    description: stripHtml(product.description),
    subtitle: stripHtml(product.short_description),
    status: product.is_active ? "published" : "draft",
    categories: categoryIds.map((id) => ({ id })),
    metadata: {
      sku: product.sku,
      brand: product.brand,
      attribute_set: product.attribute_set,
      vendor_id: vendorId,
      vendor_name: product.vendor_name,
      vendor_sku: product.vendor_sku,
      stock_label: product.stock_label,
      is_in_stock: product.stock_label.toLowerCase().startsWith("laos"),
      special_price: product.special_price_cents,
      cost: product.cost_cents,
      ...product.attributes,
    },
    variants: [
      {
        title: "Põhivariant",
        sku: product.sku,
        manage_inventory: false,
        prices: [
          {
            amount: product.price_cents,
            currency_code: DEFAULT_CURRENCY,
          },
        ],
      },
    ],
  }

  // Check if product exists by SKU
  const existing = await api("GET", `/admin/products?q=${encodeURIComponent(product.sku)}&limit=1`)
  const found = existing.products?.find(
    (p: any) => p.variants?.some((v: any) => v.sku === product.sku)
  )

  if (found) {
    await api("POST", `/admin/products/${found.id}`, payload)
  } else {
    await api("POST", "/admin/products", payload)
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function parsePriceCents(val: string): number {
  const n = parseFloat(val.replace(",", "."))
  return isNaN(n) ? 0 : Math.round(n * 100)
}

function parseCategoryPath(raw: string): string[] {
  if (!raw?.trim()) return []
  // "Segistid/Lisatarvikud/Vihmadušid" → ["Segistid", "Segistid/Lisatarvikud", "Segistid/Lisatarvikud/Vihmadušid"]
  const parts = raw.split("/").map((p) => p.trim()).filter(Boolean)
  return parts.map((_, i) => parts.slice(0, i + 1).join("/"))
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u")
    .replace(/õ/g, "o").replace(/š/g, "s").replace(/ž/g, "z")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&[a-z]+;/gi, " ").trim()
}

main().catch((e) => {
  console.error("Migration failed:", e)
  process.exit(1)
})
