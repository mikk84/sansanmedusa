/**
 * attach-images.ts — link migrated Magento product images to Medusa products.
 *
 * Run with:
 *   pnpm exec medusa exec ./src/scripts/attach-images.ts
 *
 * Prereqs:
 *   - Products imported (each carries metadata.magento_id) — see import-magento.ts
 *   - The Magento dump is loaded in the throwaway MariaDB (host port 3307)
 *   - The image files are downloaded to <repo>/media/catalog/product and
 *     symlinked into apps/backend/static/catalog (served at /static)
 *
 * For each product it reads the Magento base image + media gallery, verifies the
 * file exists locally, and sets the product's thumbnail + images to
 *   ${MEDUSA_BACKEND_URL}/static/catalog/product<path>
 *
 * Idempotent: re-running overwrites the image set with the same URLs.
 * Images are skipped for files that aren't present locally.
 */

import { ExecArgs } from "@medusajs/framework/types"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"
import mysql from "mysql2/promise"
import fs from "fs"
import path from "path"

const MYSQL = {
  host: process.env.MAGENTO_DB_HOST || "127.0.0.1",
  port: Number(process.env.MAGENTO_DB_PORT || 3307),
  user: process.env.MAGENTO_DB_USER || "root",
  password: process.env.MAGENTO_DB_PASSWORD || "root",
  database: process.env.MAGENTO_DB_NAME || "magento",
}
const PRODUCT_ENTITY_TYPE = 4
const STATIC_BASE = `${process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"}/static/catalog/product`
// Local root the /static/catalog symlink points at, for existence checks.
const MEDIA_ROOT = path.resolve(process.cwd(), "static/catalog/product")
const BATCH = 200

export default async function attachImages({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const productService = container.resolve(Modules.PRODUCT)

  const db = await mysql.createConnection(MYSQL)
  const q = async (sql: string, params: any[] = []) =>
    (await db.query(sql, params))[0] as any[]

  // ── Magento image attribute id ───────────────────────────────────────────
  const [imgAttr] = await q(
    `SELECT attribute_id FROM eav_attribute WHERE attribute_code='image' AND entity_type_id=?`,
    [PRODUCT_ENTITY_TYPE]
  )
  const imageAttrId = imgAttr.attribute_id

  // ── Bulk-load base images + galleries keyed by magento entity_id ──────────
  const baseRows = await q(
    `SELECT entity_id, value FROM catalog_product_entity_varchar
      WHERE store_id=0 AND attribute_id=? AND value LIKE '/%' AND value!='no_selection'`,
    [imageAttrId]
  )
  const baseImage = new Map<number, string>()
  for (const r of baseRows) baseImage.set(r.entity_id, r.value)

  // position / disabled live in the _value join table; LEFT JOIN store 0 (admin)
  // to skip disabled images and preserve display order.
  const galleryRows = await q(
    `SELECT g.entity_id, g.value, gv.position, gv.disabled
       FROM catalog_product_entity_media_gallery g
       LEFT JOIN catalog_product_entity_media_gallery_value gv
         ON gv.value_id = g.value_id AND gv.store_id = 0
      WHERE g.value LIKE '/%'
      ORDER BY g.entity_id, COALESCE(gv.position, g.value_id)`
  )
  const gallery = new Map<number, string[]>()
  for (const r of galleryRows) {
    if (r.disabled) continue
    if (!gallery.has(r.entity_id)) gallery.set(r.entity_id, [])
    gallery.get(r.entity_id)!.push(r.value)
  }

  const fileExists = (relPath: string) =>
    fs.existsSync(path.join(MEDIA_ROOT, relPath.replace(/^\//, "")))

  // ── Walk Medusa products (paginated) and update images ────────────────────
  let offset = 0
  let updated = 0
  let noMagentoId = 0
  let noImages = 0
  let missingFiles = 0

  for (;;) {
    const { data: products } = await query.graph({
      entity: "product",
      fields: ["id", "metadata"],
      pagination: { skip: offset, take: BATCH },
    })
    if (!products.length) break

    for (const p of products) {
      const magentoId = Number(p.metadata?.magento_id)
      if (!magentoId) { noMagentoId++; continue }

      // ordered, deduped list of relative paths: base image first
      const paths: string[] = []
      const seen = new Set<string>()
      const push = (v?: string) => {
        if (v && !seen.has(v)) { seen.add(v); paths.push(v) }
      }
      push(baseImage.get(magentoId))
      for (const g of gallery.get(magentoId) || []) push(g)

      const localPaths = paths.filter((rp) => {
        const ok = fileExists(rp)
        if (!ok) missingFiles++
        return ok
      })
      if (!localPaths.length) { noImages++; continue }

      const urls = localPaths.map((rp) => `${STATIC_BASE}${rp}`)
      await productService.updateProducts(p.id, {
        thumbnail: urls[0],
        images: urls.map((url) => ({ url })),
      })
      updated++
    }

    offset += products.length
    logger.info(`attach-images — processed ${offset}, updated ${updated}`)
  }

  await db.end()
  logger.info(
    `attach-images — DONE. updated ${updated}, no magento_id ${noMagentoId}, ` +
    `no local images ${noImages}, missing files ${missingFiles}`
  )
}
