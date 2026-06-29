/**
 * import-magento.ts — migrate the Magento 1.9 catalog into Medusa v2.
 *
 * Run with:
 *   pnpm exec medusa exec ./src/scripts/import-magento.ts
 *
 * Reads from a throwaway MariaDB container holding the full Magento dump
 * (see docs/setup-notes.md → "Product migration"). Imports:
 *   - 28 vendors (hankija) with dropship / via_terminal fulfillment type
 *   - the category tree (preserving parent hierarchy)
 *   - 4,095 enabled products with price, special price, brand, vendor,
 *     stock label, and all non-empty attribute values (select options resolved
 *     to their labels) captured into product metadata
 *
 * Idempotent-ish: skips products whose SKU already exists, and vendors /
 * categories matched by name / handle.
 *
 * Images are intentionally skipped for this pass (the dump holds only file
 * paths, not the binaries — see the migration plan in docs/setup-notes.md).
 */

import { ExecArgs } from "@medusajs/framework/types"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/core-flows"
import { createProductCategoriesWorkflow } from "@medusajs/core-flows"
import mysql from "mysql2/promise"
import { VENDOR_MODULE } from "../modules/vendor"

// ── Magento connection (throwaway MariaDB container) ────────────────────────
const MYSQL = {
  host: process.env.MAGENTO_DB_HOST || "127.0.0.1",
  port: Number(process.env.MAGENTO_DB_PORT || 3307),
  user: process.env.MAGENTO_DB_USER || "root",
  password: process.env.MAGENTO_DB_PASSWORD || "root",
  database: process.env.MAGENTO_DB_NAME || "magento",
}

const PRODUCT_ENTITY_TYPE = 4 // catalog_product (from eav_entity_type)
const PRODUCT_BATCH = 100
// Set MAGENTO_LIMIT to import only the first N products (validation runs).
const LIMIT = Number(process.env.MAGENTO_LIMIT || 0)

// Vendors that drop-ship straight to the customer. Everything else defaults to
// via_terminal (ships to SanSan first). Adjust as the real rules are confirmed.
const DROPSHIP_VENDORS = new Set<string>([
  "SANITINO s.r.o.",
  "Ravak a.s.",
  "Duschy Marketing AS",
  "Casa Di Vanna",
  "Gemlook OÜ",
  "Vispool",
])

// Structural / non-product categories we don't want in the storefront tree.
const SKIP_CATEGORY_NAMES = new Set<string>([
  "Default Category",
  "Home Furniture",
  "Root Catalog",
])

type Row = Record<string, any>

export default async function importMagento({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL)
  const productService = container.resolve(Modules.PRODUCT)
  const vendorService: any = container.resolve(VENDOR_MODULE)

  const db = await mysql.createConnection(MYSQL)
  const q = async (sql: string, params: any[] = []): Promise<Row[]> => {
    const [rows] = await db.query(sql, params)
    return rows as Row[]
  }

  logger.info("Magento import — connected to MariaDB")

  // ── Resolve default sales channel + shipping profile ──────────────────────
  const [salesChannel] = await salesChannelService.listSalesChannels(
    { name: "Default Sales Channel" },
    { take: 1 }
  )
  const {
    data: [shippingProfile],
  } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
    pagination: { take: 1 },
  })
  if (!salesChannel || !shippingProfile) {
    throw new Error("Missing default sales channel or shipping profile")
  }

  // ── Attribute id lookup ───────────────────────────────────────────────────
  const attrRows = await q(
    `SELECT attribute_id, attribute_code, frontend_label, backend_type, frontend_input, is_user_defined
       FROM eav_attribute WHERE entity_type_id = ?`,
    [PRODUCT_ENTITY_TYPE]
  )
  const attrByCode = new Map<string, Row>()
  const attrById = new Map<number, Row>()
  for (const a of attrRows) {
    attrByCode.set(a.attribute_code, a)
    attrById.set(a.attribute_id, a)
  }
  const idOf = (code: string) => attrByCode.get(code)?.attribute_id

  // ── Resolve select-option labels (store_id=0) ─────────────────────────────
  const optionRows = await q(
    `SELECT ov.option_id, ov.value
       FROM eav_attribute_option_value ov WHERE ov.store_id = 0`
  )
  const optionLabel = new Map<number, string>()
  for (const o of optionRows) optionLabel.set(o.option_id, o.value)

  // ── Enabled products (status = 1) ─────────────────────────────────────────
  const statusId = idOf("status")
  const enabled = await q(
    `SELECT e.entity_id, e.sku, e.attribute_set_id
       FROM catalog_product_entity e
       JOIN catalog_product_entity_int st
         ON st.entity_id = e.entity_id AND st.store_id = 0
        AND st.attribute_id = ? AND st.value = 1`,
    [statusId]
  )
  logger.info(`Magento import — ${enabled.length} enabled products`)

  // attribute_set_id → name
  const setRows = await q(
    `SELECT attribute_set_id, attribute_set_name FROM eav_attribute_set
       WHERE entity_type_id = ?`,
    [PRODUCT_ENTITY_TYPE]
  )
  const setName = new Map<number, string>()
  for (const s of setRows) setName.set(s.attribute_set_id, s.attribute_set_name)

  // ── Bulk-load all attribute values for enabled products ───────────────────
  // Build per-entity attribute maps (code → resolved value).
  const values = new Map<number, Record<string, any>>()
  for (const p of enabled) values.set(p.entity_id, {})

  const loadTable = async (table: string, resolveOption = false) => {
    const rows = await q(
      `SELECT t.entity_id, t.attribute_id, t.value
         FROM ${table} t
         JOIN catalog_product_entity e ON e.entity_id = t.entity_id
         JOIN catalog_product_entity_int st
           ON st.entity_id = e.entity_id AND st.store_id = 0
          AND st.attribute_id = ? AND st.value = 1
        WHERE t.store_id = 0`,
      [statusId]
    )
    for (const r of rows) {
      const attr = attrById.get(r.attribute_id)
      if (!attr) continue
      const bag = values.get(r.entity_id)
      if (!bag) continue
      let v: any = r.value
      if (resolveOption && v != null) v = optionLabel.get(Number(v)) ?? v
      if (v !== null && v !== "" && bag[attr.attribute_code] === undefined) {
        bag[attr.attribute_code] = v
      }
    }
  }

  await loadTable("catalog_product_entity_varchar")
  await loadTable("catalog_product_entity_text")
  await loadTable("catalog_product_entity_decimal")
  await loadTable("catalog_product_entity_int", true) // resolve select labels
  logger.info("Magento import — attribute values loaded")

  // ── Categories ────────────────────────────────────────────────────────────
  const catNameId = await q(
    `SELECT attribute_id FROM eav_attribute
      WHERE attribute_code = 'name'
        AND entity_type_id = (SELECT entity_type_id FROM eav_entity_type WHERE entity_type_code='catalog_category')`
  )
  const categoryNameAttrId = catNameId[0].attribute_id
  const catRows = await q(
    `SELECT e.entity_id, e.parent_id, e.level, e.path, v.value AS name
       FROM catalog_category_entity e
       JOIN catalog_category_entity_varchar v
         ON v.entity_id = e.entity_id AND v.store_id = 0 AND v.attribute_id = ?
      WHERE e.level >= 2
      ORDER BY e.level, e.position`,
    [categoryNameAttrId]
  )
  const catProducts = await q(
    `SELECT product_id, category_id FROM catalog_category_product`
  )

  // Create categories level by level so parents exist first.
  // The Magento tree reuses names (e.g. "Lisatarvikud" under several parents),
  // so handles are made globally unique with a numeric suffix on collision.
  const magentoToMedusaCat = new Map<number, string>()
  const existingCats = await productService.listProductCategories({}, { take: 5000 })
  const usedCatHandles = new Set<string>()
  for (const c of existingCats) usedCatHandles.add(c.handle)
  const uniqueHandle = (base: string) => {
    let h = base || "kategooria"
    let n = 2
    while (usedCatHandles.has(h)) h = `${base}-${n++}`
    usedCatHandles.add(h)
    return h
  }

  const levels = [...new Set(catRows.map((c) => c.level))].sort((a, b) => a - b)
  for (const level of levels) {
    const atLevel = catRows.filter(
      (c) => c.level === level && !SKIP_CATEGORY_NAMES.has((c.name || "").trim())
    )
    const toCreate: any[] = []
    const createdMagentoIds: number[] = []
    for (const c of atLevel) {
      const base = slugify(c.name)
      if (!base) continue
      const parentMedusaId = magentoToMedusaCat.get(c.parent_id) ?? null
      toCreate.push({
        name: (c.name || "").trim(),
        handle: uniqueHandle(base),
        is_active: true,
        parent_category_id: parentMedusaId,
      })
      createdMagentoIds.push(c.entity_id)
    }
    if (toCreate.length) {
      const { result } = await createProductCategoriesWorkflow(container).run({
        input: { product_categories: toCreate },
      })
      result.forEach((cat: any, i: number) => {
        magentoToMedusaCat.set(createdMagentoIds[i], cat.id)
      })
    }
  }
  logger.info(`Magento import — categories ready (${magentoToMedusaCat.size} mapped)`)

  // product_id → [medusa category ids]
  const productCats = new Map<number, Set<string>>()
  for (const cp of catProducts) {
    const medusaId = magentoToMedusaCat.get(cp.category_id)
    if (!medusaId) continue
    if (!productCats.has(cp.product_id)) productCats.set(cp.product_id, new Set())
    productCats.get(cp.product_id)!.add(medusaId)
  }

  // ── Vendors ───────────────────────────────────────────────────────────────
  const vendorNames = new Set<string>()
  for (const p of enabled) {
    const v = values.get(p.entity_id)?.["hankija"]
    if (v) vendorNames.add(v)
  }
  const existingVendors = await vendorService.listVendors({}, { take: 1000 })
  const vendorByName = new Map<string, string>()
  for (const v of existingVendors) vendorByName.set(v.name, v.id)
  for (const name of vendorNames) {
    if (vendorByName.has(name)) continue
    const created = await vendorService.createVendors({
      name,
      email: "",
      fulfillment_type: DROPSHIP_VENDORS.has(name) ? "dropship" : "via_terminal",
      is_active: true,
    })
    vendorByName.set(name, created.id)
  }
  logger.info(`Magento import — ${vendorByName.size} vendors ready`)

  // ── Build product payloads ────────────────────────────────────────────────
  const existingProducts = await productService.listProducts({}, { take: 20000, select: ["id"], relations: [] })
  // We dedupe by handle/sku via a fresh variant-sku lookup instead:
  const existingSkus = new Set<string>()
  const variantRows = await productService.listProductVariants({}, { take: 50000, select: ["sku"] })
  for (const v of variantRows) if (v.sku) existingSkus.add(v.sku)

  const usedHandles = new Set<string>() // product handles (separate namespace from categories)

  const payloads: any[] = []
  let skipped = 0
  for (const p of enabled) {
    const bag = values.get(p.entity_id) || {}
    const sku = (p.sku || "").trim()
    if (!sku || existingSkus.has(sku)) { skipped++; continue }

    const name = (bag["name"] || "").trim() || sku
    let handle = slugify(bag["url_key"] || name || sku)
    if (!handle) handle = `toode-${p.entity_id}`
    // ensure unique handle within this run
    let h = handle, n = 2
    while (usedHandles.has(h)) h = `${handle}-${n++}`
    handle = h
    usedHandles.add(handle)

    const price = toAmount(bag["price"])
    const special = toAmount(bag["special_price"])
    const brand = bag["tootja"] || null
    const vendorName = bag["hankija"] || null
    const vendorId = vendorName ? vendorByName.get(vendorName) : null
    const stockLabel = bag["custom_stock_status"] || "Laos"

    // capture all non-system attribute values into metadata
    const metadata: Record<string, any> = {
      magento_id: p.entity_id,
      sku,
      brand,
      vendor_name: vendorName,
      vendor_id: vendorId,
      vendor_sku: bag["hankija_kood"] || null,
      attribute_set: setName.get(p.attribute_set_id) || null,
      stock_label: stockLabel,
      special_price: special,
    }
    for (const [code, val] of Object.entries(bag)) {
      if (SYSTEM_ATTRS.has(code)) continue
      if (typeof val === "string" && val.length > 800) continue
      metadata[code] = val
    }
    // Display-ready, labelled, fully-resolved attribute list for the PDP.
    metadata.attributes = buildDisplayAttributes(bag, attrByCode, optionLabel)

    const catIds = [...(productCats.get(p.entity_id) || [])]

    payloads.push({
      title: name,
      handle,
      status: "published",
      description: stripHtml(bag["description"] || ""),
      subtitle: stripHtml(bag["short_description"] || "").slice(0, 250) || undefined,
      category_ids: catIds,
      shipping_profile_id: shippingProfile.id,
      sales_channels: [{ id: salesChannel.id }],
      options: [{ title: "Variant", values: ["Standard"] }],
      variants: [
        {
          title: "Standard",
          sku,
          manage_inventory: false,
          options: { Variant: "Standard" },
          prices: [{ amount: special ?? price ?? 0, currency_code: "eur" }],
        },
      ],
      metadata,
    })
  }
  const finalPayloads = LIMIT > 0 ? payloads.slice(0, LIMIT) : payloads
  logger.info(`Magento import — ${finalPayloads.length} products to create, ${skipped} skipped (existing/no SKU)${LIMIT ? ` [LIMIT ${LIMIT}]` : ""}`)

  // ── Create products in batches ────────────────────────────────────────────
  let created = 0
  const errors: string[] = []
  for (let i = 0; i < finalPayloads.length; i += PRODUCT_BATCH) {
    const batch = finalPayloads.slice(i, i + PRODUCT_BATCH)
    try {
      await createProductsWorkflow(container).run({ input: { products: batch } })
      created += batch.length
      logger.info(`Magento import — ${created}/${payloads.length} products created`)
    } catch (e: any) {
      errors.push(`batch ${i}: ${e.message}`)
      logger.error(`Magento import — batch ${i} failed: ${e.message}`)
    }
  }

  await db.end()
  logger.info(`Magento import — DONE. Created ${created}, skipped ${skipped}, batch errors ${errors.length}`)
  if (errors.length) errors.slice(0, 5).forEach((e) => logger.error(e))
}

// ── helpers ─────────────────────────────────────────────────────────────────
const SYSTEM_ATTRS = new Set<string>([
  "name", "url_key", "url_path", "description", "short_description", "price",
  "special_price", "status", "tootja", "hankija", "hankija_kood",
  "custom_stock_status", "image", "small_image", "thumbnail", "media_gallery",
  "meta_title", "meta_description", "meta_keyword", "options_container",
  "custom_design", "gift_message_available", "tax_class_id", "visibility",
  // sensitive — never expose purchase cost on the storefront
  "cost",
  // Magento internal / pricing-engine noise
  "msrp", "msrp_enabled", "msrp_display_actual_price_type", "is_recurring",
  "is_imported", "hide_default_stock_status", "custom_stock_status_quantity_based",
  "news_from_date", "news_to_date", "special_from_date", "special_to_date",
  "country_of_manufacture", "enable_googlecheckout", "page_layout",
  "custom_layout_update", "gift_wrapping_available", "gift_wrapping_price",
])

// Attributes excluded from the PDP display list (internal / pricing / SEO /
// supplier). Note: `tootja` (Kaubamärk) and `weight` (Transpordikaal) are kept.
const DISPLAY_SKIP = new Set<string>([
  "name", "url_key", "url_path", "description", "short_description", "price",
  "special_price", "status", "custom_stock_status", "image", "small_image",
  "thumbnail", "media_gallery", "meta_title", "meta_description", "meta_keyword",
  "options_container", "custom_design", "gift_message_available", "tax_class_id",
  "visibility", "cost", "hankija", "hankija_kood",
  "msrp", "msrp_enabled", "msrp_display_actual_price_type", "is_recurring",
  "is_imported", "hide_default_stock_status", "custom_stock_status_quantity_based",
  "news_from_date", "news_to_date", "special_from_date", "special_to_date",
  "country_of_manufacture", "enable_googlecheckout", "page_layout",
  "custom_layout_update", "gift_wrapping_available", "gift_wrapping_price",
])

type DisplayAttr = { label: string; value: string; url?: string }

/**
 * Build the labelled, resolved attribute list shown on the PDP:
 *  - multiselect values (comma-separated option ids in a text column) → labels
 *  - link-type HTML values (e.g. Paigaldusjuhend) → { value, url }
 *  - plain HTML stripped to text
 */
function buildDisplayAttributes(
  bag: Record<string, any>,
  attrByCode: Map<string, Row>,
  optionLabel: Map<number, string>
): DisplayAttr[] {
  const out: DisplayAttr[] = []
  for (const [code, raw] of Object.entries(bag)) {
    if (DISPLAY_SKIP.has(code)) continue
    const attr = attrByCode.get(code)
    const label = (attr?.frontend_label || "").trim()
    if (!label || raw === null || raw === undefined || raw === "") continue

    // Link-type HTML (installation guides etc.) — surface the href.
    const hrefMatch = typeof raw === "string" && /<a\s[^>]*href=["']([^"']+)["']/i.exec(raw)
    if (hrefMatch) {
      out.push({ label, value: "Vaata juhendit", url: hrefMatch[1] })
      continue
    }

    let value = String(raw)
    if (attr?.frontend_input === "multiselect" && /^[\d,]+$/.test(value)) {
      value = value
        .split(",")
        .map((id) => optionLabel.get(Number(id.trim())) || "")
        .filter(Boolean)
        .join(", ")
    }
    value = value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
    // trim noisy decimal zeros, e.g. "40.0000" → "40", "1.5000" → "1.5"
    if (/^\d+\.\d+$/.test(value)) value = String(parseFloat(value))
    if (!value) continue
    out.push({ label, value })
  }
  // stable, readable order
  return out.sort((a, b) => a.label.localeCompare(b.label, "et"))
}

function toAmount(v: any): number | null {
  if (v === null || v === undefined || v === "") return null
  const n = Number(v)
  return isNaN(n) ? null : Math.round(n * 100) / 100
}

function slugify(str: string): string {
  return String(str || "")
    .toLowerCase()
    .replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u")
    .replace(/õ/g, "o").replace(/š/g, "s").replace(/ž/g, "z")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

// Named HTML entities that appear in the Magento WYSIWYG content (Estonian +
// common punctuation). Everything else is handled by numeric decoding below.
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  shy: "", zwnj: "", zwj: "", // invisible formatting hints — drop them
  auml: "ä", Auml: "Ä", ouml: "ö", Ouml: "Ö", uuml: "ü", Uuml: "Ü",
  otilde: "õ", Otilde: "Õ", aring: "å", Aring: "Å", aelig: "æ", oslash: "ø",
  scaron: "š", Scaron: "Š", zcaron: "ž", Zcaron: "Ž",
  eacute: "é", egrave: "è", agrave: "à", uacute: "ú", iacute: "í", oacute: "ó",
  ccedil: "ç", ntilde: "ñ", szlig: "ß",
  deg: "°", times: "×", divide: "÷", middot: "·", bull: "•",
  mdash: "—", ndash: "–", hellip: "…", laquo: "«", raquo: "»",
  ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’",
  euro: "€", copy: "©", reg: "®", trade: "™",
  sup2: "²", sup3: "³", frac12: "½", frac14: "¼", frac34: "¾",
}

function decodeEntities(s: string): string {
  return s
    // numeric: &#228; and &#xE4;
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeCodePoint(parseInt(d, 10)))
    // named
    .replace(/&([a-z][a-z0-9]*);/gi, (m, name) =>
      NAMED_ENTITIES[name] ?? NAMED_ENTITIES[name.toLowerCase()] ?? m
    )
}

function safeCodePoint(cp: number): string {
  try {
    return Number.isFinite(cp) && cp > 0 ? String.fromCodePoint(cp) : ""
  } catch {
    return ""
  }
}

function stripHtml(html: string): string {
  return decodeEntities(String(html || ""))
    // Magento WYSIWYG directives: {{media url="..."}}, {{widget ...}}
    .replace(/\{\{[^}]*\}\}/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}
