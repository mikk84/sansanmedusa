/**
 * Sample catalog data — placeholder until the Magento CSV is migrated into Medusa.
 *
 * These shapes mirror what the Medusa Store API + Meilisearch will return, so the
 * PLP/PDP/checkout pages can be wired to `lib/medusa.ts` later by swapping the
 * data source without touching the components.
 *
 * Prices are stored in cents (EUR), matching Medusa's convention.
 */

export type SampleProduct = {
  id: string
  slug: string
  name: string
  brand: string
  sku: string
  price: number // cents
  special_price?: number | null // cents
  badge?: "new" | "sale" | "order" | null // UUS / −% / TELLIMUSEL
  in_stock: boolean
  delivery: string
  category: string // category slug
  short_description: string
  attributes: { label: string; value: string }[]
  sizes?: string[]
  rating?: number
  review_count?: number
  // Populated when sourced from Medusa (sample data leaves these undefined)
  image_url?: string | null
  images?: string[]
  description?: string
  variant_id?: string // default/first variant — needed to add to cart
}

export type SampleCategory = {
  slug: string
  label: string
  count: number
}

export type SampleBrand = { name: string; count: number }

export const CATEGORIES: SampleCategory[] = [
  { slug: "vannid", label: "Vannid", count: 124 },
  { slug: "dusinurgad", label: "Dušinurgad", count: 98 },
  { slug: "wc-potid", label: "WC-potid", count: 56 },
  { slug: "segistid", label: "Segistid", count: 142 },
  { slug: "valamud", label: "Valamud", count: 87 },
  { slug: "mooebel", label: "Vannitoamööbel", count: 63 },
  { slug: "saun", label: "Saun", count: 41 },
  { slug: "kute", label: "Küte & radiaatorid", count: 52 },
  { slug: "aksessuaarid", label: "Aksessuaarid", count: 96 },
]

/** Subcategory filter options keyed by parent category slug. */
export const SUBCATEGORIES: Record<string, { label: string; count: number }[]> = {
  "wc-potid": [
    { label: "Seinapealsed", count: 38 },
    { label: "Põrandale", count: 18 },
    { label: "Kompakt WC", count: 12 },
    { label: "Bideed", count: 7 },
  ],
  vannid: [
    { label: "Akrüülvannid", count: 64 },
    { label: "Vabaltseisvad", count: 28 },
    { label: "Nurgavannid", count: 19 },
    { label: "Massaaživannid", count: 13 },
  ],
}

export const BRANDS_BY_CATEGORY: Record<string, SampleBrand[]> = {
  "wc-potid": [
    { name: "Duravit", count: 14 },
    { name: "VitrA", count: 9 },
    { name: "Grohe", count: 11 },
    { name: "Geberit", count: 8 },
  ],
  vannid: [
    { name: "Ravak", count: 22 },
    { name: "Kaldewei", count: 14 },
    { name: "Riho", count: 18 },
    { name: "Villeroy & Boch", count: 9 },
  ],
}

const WC_ATTRIBUTES = [
  { label: "Materjal", value: "Keraamika" },
  { label: "Paigaldus", value: "Seinale" },
  { label: "Loputus", value: "Rimfree®" },
  { label: "Värv", value: "Valge läikiv" },
  { label: "Mõõdud", value: "480×360 mm" },
  { label: "SoftClose iste", value: "Komplektis" },
]

export const PRODUCTS: SampleProduct[] = [
  {
    id: "1",
    slug: "duravit-dcode-ii-seinapealne-wc-pott",
    name: "D-Code II seinapealne WC-pott · Rimfree",
    brand: "Duravit",
    sku: "DU-DCII-480",
    price: 38300,
    special_price: 34900,
    badge: "new",
    in_stock: true,
    delivery: "Tarne 2–5 päeva",
    category: "wc-potid",
    short_description:
      "Servata (Rimfree®) konstruktsioon tagab hügieenilise ja kergesti puhastatava pinna. Vähendatud veekulu, vaikne loputus ning ajatu skandinaavialik disain — sobib ideaalselt nii uusehitusse kui renoveerimisse.",
    attributes: WC_ATTRIBUTES,
    sizes: ["480 mm", "350 mm", "540 mm"],
    rating: 4.4,
    review_count: 52,
  },
  {
    id: "2",
    slug: "vitra-s50-seinapealne-wc-komplekt",
    name: "S50 seinapealne WC-komplekt",
    brand: "VitrA",
    sku: "VT-S50-KOMPL",
    price: 48900,
    special_price: 39900,
    badge: "sale",
    in_stock: true,
    delivery: "Tarne 1–2 tööpäeva",
    category: "wc-potid",
    short_description:
      "Komplektne seinapealne WC lahendus koos SoftClose istmega. Servata loputus ja kompaktne disain väiksematesse vannitubadesse.",
    attributes: WC_ATTRIBUTES,
    sizes: ["480 mm", "540 mm"],
    rating: 4.6,
    review_count: 87,
  },
  {
    id: "3",
    slug: "grohe-solido-seinapealne-wc-pott",
    name: "Solido seinapealne WC-pott",
    brand: "Grohe",
    sku: "GR-SOLIDO-WC",
    price: 27900,
    special_price: null,
    badge: null,
    in_stock: true,
    delivery: "Tarne 2–5 päeva",
    category: "wc-potid",
    short_description:
      "Vastupidav ja ajatu seinapealne WC-pott Grohe kvaliteediga. Lihtne paigaldada ja hooldada.",
    attributes: WC_ATTRIBUTES,
    sizes: ["480 mm"],
    rating: 4.2,
    review_count: 31,
  },
  {
    id: "4",
    slug: "geberit-icon-seinapealne-wc-pott",
    name: "iCon seinapealne WC-pott",
    brand: "Geberit",
    sku: "GB-ICON-WC",
    price: 42900,
    special_price: null,
    badge: "order",
    in_stock: false,
    delivery: "Tarne 7–14 päeva",
    category: "wc-potid",
    short_description:
      "Geberit iCon seeria — minimalistlik disain ja TurboFlush loputustehnoloogia vaikseks ja võimsaks loputuseks.",
    attributes: WC_ATTRIBUTES,
    sizes: ["490 mm", "530 mm"],
    rating: 4.5,
    review_count: 44,
  },
  {
    id: "5",
    slug: "ravak-chrome-seinapealne-wc-pott",
    name: "Chrome seinapealne WC-pott",
    brand: "Ravak",
    sku: "RV-CHROME-WC",
    price: 31900,
    special_price: null,
    badge: null,
    in_stock: true,
    delivery: "Tarne 2–5 päeva",
    category: "wc-potid",
    short_description:
      "Ravak Chrome — puhas joon ja praktilisus. Sobib hästi kaasaegsesse vannituppa.",
    attributes: WC_ATTRIBUTES,
    sizes: ["490 mm"],
    rating: 4.1,
    review_count: 18,
  },
  {
    id: "6",
    slug: "ideal-standard-tesi-seinapealne-wc-pott",
    name: "Tesi seinapealne WC-pott",
    brand: "Ideal Standard",
    sku: "IS-TESI-WC",
    price: 38900,
    special_price: null,
    badge: null,
    in_stock: true,
    delivery: "Tarne 2–5 päeva",
    category: "wc-potid",
    short_description:
      "Ideal Standard Tesi AquaBlade® tehnoloogiaga — hügieeniline ja säästlik loputus.",
    attributes: WC_ATTRIBUTES,
    sizes: ["490 mm", "530 mm"],
    rating: 4.3,
    review_count: 26,
  },
]

export function getProductBySlug(slug: string): SampleProduct | undefined {
  return PRODUCTS.find((p) => p.slug === slug)
}

export function getCategoryBySlug(slug: string): SampleCategory | undefined {
  return CATEGORIES.find((c) => c.slug === slug)
}

export function getProductsByCategory(slug: string): SampleProduct[] {
  const inCat = PRODUCTS.filter((p) => p.category === slug)
  return inCat.length ? inCat : PRODUCTS
}
