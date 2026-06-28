import { MedusaService } from "@medusajs/framework/utils"
import { MeiliSearch } from "meilisearch"

type SearchOptions = {
  host: string
  apiKey: string
}

/**
 * Meilisearch integration for product search.
 *
 * Index name: "products"
 * Searchable attributes: name, description, sku, brand (tootja), category
 * Filterable: brand, category, price range, in_stock
 * Sortable: price, created_at
 *
 * Products are indexed when created or updated via the product-indexed subscriber.
 */
export class SearchModuleService extends MedusaService({}) {
  private client: MeiliSearch

  constructor(container: any, options: SearchOptions) {
    super(...arguments)
    this.client = new MeiliSearch({
      host: options.host,
      apiKey: options.apiKey,
    })
  }

  async setupIndex(): Promise<void> {
    const index = this.client.index("products")

    await index.updateSettings({
      searchableAttributes: [
        "name",
        "sku",
        "brand",
        "short_description",
        "category",
        "attribute_set",
      ],
      filterableAttributes: [
        "brand",
        "category",
        "attribute_set",
        "price",
        "is_in_stock",
        "fulfillment_type",
      ],
      sortableAttributes: ["price", "created_at", "name"],
      displayedAttributes: [
        "id",
        "sku",
        "name",
        "short_description",
        "price",
        "special_price",
        "brand",
        "category",
        "image_url",
        "slug",
        "is_in_stock",
        "stock_label",
      ],
    })
  }

  async indexProduct(product: any): Promise<void> {
    const index = this.client.index("products")
    await index.addDocuments([this.transform(product)], { primaryKey: "id" })
  }

  async indexProducts(products: any[]): Promise<void> {
    const index = this.client.index("products")
    await index.addDocuments(products.map(this.transform), { primaryKey: "id" })
  }

  async removeProduct(productId: string): Promise<void> {
    const index = this.client.index("products")
    await index.deleteDocument(productId)
  }

  async search(
    query: string,
    options: {
      filters?: string
      sort?: string[]
      page?: number
      hitsPerPage?: number
    } = {}
  ) {
    const index = this.client.index("products")
    return index.search(query, {
      filter: options.filters,
      sort: options.sort,
      page: options.page || 1,
      hitsPerPage: options.hitsPerPage || 24,
      attributesToHighlight: ["name"],
    })
  }

  private transform(product: any) {
    const price = product.variants?.[0]?.prices?.[0]?.amount || 0
    return {
      id: product.id,
      sku: product.metadata?.sku,
      name: product.title,
      short_description: product.subtitle || "",
      price,
      special_price: product.metadata?.special_price || null,
      brand: product.metadata?.brand,
      category: product.categories?.[0]?.name,
      attribute_set: product.metadata?.attribute_set,
      image_url: product.images?.[0]?.url,
      slug: product.handle,
      is_in_stock: product.metadata?.is_in_stock !== false,
      stock_label: product.metadata?.stock_label || "Laos",
    }
  }
}
