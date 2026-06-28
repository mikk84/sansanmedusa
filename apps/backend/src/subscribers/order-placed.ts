import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { notifyVendorsWorkflow } from "../workflows/notify-vendors"

/**
 * Triggered when a customer completes checkout and payment is captured.
 * Kicks off vendor email notifications for all line items.
 */
export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const query = container.resolve("query")

  const { data: orders } = await query.graph({
    entity: "order",
    filters: { id: data.id },
    fields: [
      "id",
      "display_id",
      "customer.first_name",
      "customer.last_name",
      "customer.email",
      "shipping_address.*",
      "items.*",
      "items.metadata",
    ],
  })

  const order = orders[0]
  if (!order) return

  await notifyVendorsWorkflow(container).run({
    input: { order_id: order.id, order },
  })
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
