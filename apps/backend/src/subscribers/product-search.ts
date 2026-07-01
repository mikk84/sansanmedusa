import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { SEARCH_MODULE } from "../modules/search"
import type { SearchModuleService } from "../modules/search/service"

const PRODUCT_FIELDS = [
  "id",
  "title",
  "subtitle",
  "handle",
  "metadata",
  "images.url",
  "categories.name",
  "variants.price_set.prices.amount",
  "variants.price_set.prices.currency_code",
]

/**
 * Keep the Meilisearch product index in sync as products change.
 * Full backfill / manual rebuild lives in scripts/reindex-search.ts.
 */
export default async function productSearchHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const search = container.resolve<SearchModuleService>(SEARCH_MODULE)

  try {
    const { data: products } = await query.graph({
      entity: "product",
      fields: PRODUCT_FIELDS,
      filters: { id: data.id },
    })
    const product = products[0]
    // Index published products; drop anything else from the index.
    if (product && product.status === "published") {
      await search.indexProduct(product)
    } else {
      await search.removeProduct(data.id)
    }
  } catch (e: any) {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .error(`product-search — failed to index ${data.id}: ${e.message}`)
  }
}

export const config: SubscriberConfig = {
  event: ["product.created", "product.updated", "product.deleted"],
}
