import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { addToCartWorkflow } from "@medusajs/core-flows"

/**
 * POST /store/carts/:id/configure
 *
 * Adds a configured product to the cart with a custom unit price computed
 * server-side from the product's Magento custom options (base variant price +
 * additive option deltas). The chosen options are stored in line-item metadata.
 *
 * Body: { variant_id, quantity?, selections: [{ option_id, value_id?, value_ids?, text? }] }
 *
 * Server-side pricing prevents tampering — the client only sends *which* options
 * were chosen, never the price.
 */
type Selection = {
  option_id: number
  value_id?: number
  value_ids?: number[]
  text?: string
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const cartId = req.params.id
  const { variant_id, quantity = 1, selections = [] } = (req.body || {}) as {
    variant_id: string
    quantity?: number
    selections?: Selection[]
  }

  if (!variant_id) {
    return res.status(400).json({ message: "variant_id is required" })
  }

  // ── base variant price (flat EUR price set during migration) + product meta ─
  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: [
      "id",
      "title",
      "sku",
      "product.id",
      "product.title",
      "product.thumbnail",
      "product.metadata",
      "price_set.prices.amount",
      "price_set.prices.currency_code",
    ],
    filters: { id: variant_id },
  })
  const variant = variants?.[0]
  if (!variant) return res.status(404).json({ message: "Variant not found" })

  const prices = variant.price_set?.prices || []
  const base =
    Number(prices.find((p: any) => p.currency_code === "eur")?.amount ?? prices[0]?.amount ?? 0)

  const customOptions: any[] = (variant.product?.metadata?.custom_options as any[]) || []
  const optById = new Map<number, any>(customOptions.map((o) => [Number(o.id), o]))

  // ── compute surcharge from selections (trusted deltas) + build display meta ─
  let surcharge = 0
  const chosen: { title: string; value: string; price: number }[] = []

  const applyValue = (opt: any, valId: number) => {
    const v = (opt.values || []).find((x: any) => Number(x.id) === Number(valId))
    if (!v) return
    const delta = v.price_type === "percent" ? (base * Number(v.price)) / 100 : Number(v.price)
    surcharge += delta
    chosen.push({ title: opt.title, value: v.title, price: delta })
  }

  for (const sel of selections) {
    const opt = optById.get(Number(sel.option_id))
    if (!opt) continue
    if (sel.value_ids?.length) {
      sel.value_ids.forEach((vid) => applyValue(opt, vid))
    } else if (sel.value_id != null) {
      applyValue(opt, sel.value_id)
    } else if (sel.text) {
      const delta = opt.price_type === "percent" ? (base * Number(opt.price)) / 100 : Number(opt.price || 0)
      surcharge += delta
      chosen.push({ title: opt.title, value: sel.text, price: delta })
    }
  }

  const unit_price = Math.round((base + surcharge) * 100) / 100

  await addToCartWorkflow(req.scope).run({
    input: {
      cart_id: cartId,
      items: [
        {
          variant_id,
          quantity,
          unit_price, // custom price — survives cart refresh
          metadata: { configured: true, configured_options: chosen },
        },
      ],
    },
  })

  const { data: carts } = await query.graph({
    entity: "cart",
    fields: ["id", "items.*", "items.metadata", "item_total", "subtotal", "currency_code"],
    filters: { id: cartId },
  })

  res.json({ cart: carts?.[0] })
}
