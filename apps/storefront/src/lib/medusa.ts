/**
 * medusa.ts — server-side data layer for the storefront.
 *
 * Thin fetch wrappers over the Medusa Store API that map responses to the same
 * shapes the UI components already consume (see sample-data.ts). Prices are
 * returned in **cents** so the existing components (which divide by 100) work
 * unchanged, even though Medusa stores major-unit decimals.
 *
 * All functions run on the server (RSC) and use the publishable API key.
 */

import type { SampleProduct, SampleCategory } from "./sample-data"

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""

async function storeFetch<T>(path: string, revalidate = 60): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers: { "x-publishable-api-key": PUBLISHABLE_KEY },
    next: { revalidate },
  })
  if (!res.ok) {
    throw new Error(`Store API ${path} → ${res.status}: ${await res.text()}`)
  }
  return res.json() as Promise<T>
}

// Region id is needed for calculated prices; resolve once and cache per server.
let cachedRegionId: string | null = null
async function getRegionId(): Promise<string> {
  if (cachedRegionId) return cachedRegionId
  const data = await storeFetch<{ regions: { id: string; currency_code: string }[] }>(
    "/store/regions",
    3600
  )
  const eur = data.regions.find((r) => r.currency_code === "eur") || data.regions[0]
  cachedRegionId = eur?.id ?? ""
  return cachedRegionId
}

// ── Mappers ─────────────────────────────────────────────────────────────────
function toCents(amount?: number | null): number {
  return amount ? Math.round(amount * 100) : 0
}

function mapProduct(p: any): SampleProduct {
  const variant = p.variants?.[0] ?? {}
  const cp = variant.calculated_price ?? {}
  const original = toCents(cp.original_amount ?? cp.calculated_amount)
  const calculated = toCents(cp.calculated_amount)
  const hasDiscount = calculated > 0 && original > 0 && calculated < original
  const md = p.metadata ?? {}

  return {
    id: p.id,
    slug: p.handle,
    name: p.title,
    brand: md.brand || "",
    sku: variant.sku || md.sku || "",
    price: original || calculated,
    special_price: hasDiscount ? calculated : null,
    badge: hasDiscount ? "sale" : null,
    in_stock: !String(md.stock_label || "").toLowerCase().includes("tellim"),
    delivery: md.stock_label || "Tarne 1–3 tööpäeva",
    category: p.categories?.[0]?.handle || "",
    short_description: p.subtitle || "",
    image_url: p.thumbnail || null,
    images: (p.images || []).map((i: any) => i.url),
    attributes: buildAttributes(md),
    description: p.description || "",
    sizes: [],
  } as SampleProduct & { image_url: string | null; images: string[]; description: string }
}

// Surface a curated set of Magento attributes (skip internal keys) for the PDP.
const ATTR_LABELS: Record<string, string> = {
  moodud: "Mõõdud",
  varvus: "Värvus",
  segisti_varvus: "Värvus",
  materjal: "Materjal",
  garantiiaeg: "Garantii",
  boileri_maht: "Maht",
}
function buildAttributes(md: Record<string, any>): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = []
  const seenLabels = new Set<string>()
  for (const [key, label] of Object.entries(ATTR_LABELS)) {
    if (seenLabels.has(label)) continue // dedupe (e.g. varvus + segisti_varvus → "Värvus")
    const v = md[key]
    if (v && typeof v !== "object") {
      out.push({ label, value: String(v) })
      seenLabels.add(label)
    }
  }
  return out
}

const PRODUCT_FIELDS =
  "fields=id,title,handle,subtitle,thumbnail,description,metadata,*images,*categories,*variants.calculated_price,variants.sku"

// ── Public API ───────────────────────────────────────────────────────────────
export async function getFeaturedProducts(limit = 8): Promise<SampleProduct[]> {
  const region_id = await getRegionId()
  const data = await storeFetch<{ products: any[] }>(
    `/store/products?limit=${limit}&region_id=${region_id}&${PRODUCT_FIELDS}`
  )
  return data.products.map(mapProduct)
}

export async function getCategories(): Promise<SampleCategory[]> {
  const data = await storeFetch<{ product_categories: any[] }>(
    "/store/product-categories?limit=200&fields=id,name,handle,parent_category_id"
  )
  // top-level only (no parent) for the homepage strip / nav
  return data.product_categories
    .filter((c) => !c.parent_category_id)
    .map((c) => ({ slug: c.handle, label: c.name, count: 0 }))
}

export async function getCategoryByHandle(
  handle: string
): Promise<{ category: SampleCategory; subcategories: { label: string; count: number }[] } | null> {
  const data = await storeFetch<{ product_categories: any[] }>(
    `/store/product-categories?handle=${encodeURIComponent(handle)}&fields=id,name,handle,category_children.name,category_children.handle`
  )
  const c = data.product_categories?.[0]
  if (!c) return null
  return {
    category: { slug: c.handle, label: c.name, count: 0 },
    subcategories: (c.category_children || []).map((s: any) => ({ label: s.name, count: 0 })),
  }
}

export async function getProductsByCategoryHandle(
  handle: string,
  limit = 24
): Promise<{ products: SampleProduct[]; count: number }> {
  const region_id = await getRegionId()
  // resolve category id from handle
  const cat = await storeFetch<{ product_categories: { id: string }[] }>(
    `/store/product-categories?handle=${encodeURIComponent(handle)}&fields=id`
  )
  const catId = cat.product_categories?.[0]?.id
  if (!catId) return { products: [], count: 0 }
  const data = await storeFetch<{ products: any[]; count: number }>(
    `/store/products?limit=${limit}&region_id=${region_id}&category_id[]=${catId}&${PRODUCT_FIELDS}`
  )
  return { products: data.products.map(mapProduct), count: data.count }
}

export async function getProductByHandle(handle: string): Promise<SampleProduct | null> {
  const region_id = await getRegionId()
  const data = await storeFetch<{ products: any[] }>(
    `/store/products?handle=${encodeURIComponent(handle)}&region_id=${region_id}&${PRODUCT_FIELDS}`
  )
  const p = data.products?.[0]
  return p ? mapProduct(p) : null
}
