/**
 * reindex-search.ts — (re)build the Meilisearch product index (remediation C1).
 *
 * Run: pnpm exec medusa exec ./src/scripts/reindex-search.ts
 *
 * Configures the index settings, then indexes every product in batches. New /
 * updated products are kept in sync incrementally by the `product-search`
 * subscriber; this script is the one-time backfill + a manual full reindex.
 */

import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { SEARCH_MODULE } from "../modules/search"
import type { SearchModuleService } from "../modules/search/service"

const BATCH = 500

const PRODUCT_FIELDS = [
  "id",
  "title",
  "subtitle",
  "handle",
  "metadata",
  "images.url",
  "categories.name",
  "variants.id",
  "variants.price_set.prices.amount",
  "variants.price_set.prices.currency_code",
]

export default async function reindexSearch({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const search = container.resolve<SearchModuleService>(SEARCH_MODULE)

  await search.setupIndex()
  logger.info("reindex-search — index settings applied")

  let offset = 0
  let indexed = 0
  for (;;) {
    const { data: products } = await query.graph({
      entity: "product",
      fields: PRODUCT_FIELDS,
      filters: { status: "published" },
      pagination: { skip: offset, take: BATCH },
    })
    if (!products.length) break
    await search.indexProducts(products)
    indexed += products.length
    offset += products.length
    logger.info(`reindex-search — indexed ${indexed}`)
  }

  logger.info(`reindex-search — DONE, ${indexed} products indexed`)
}
