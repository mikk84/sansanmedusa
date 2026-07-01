import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { notifyVendorsWorkflow } from "../workflows/notify-vendors"
import { INVOICE_MODULE } from "../modules/invoice"
import type { InvoiceModuleService } from "../modules/invoice/service"

/**
 * Triggered when a customer completes checkout and payment is captured.
 * Fires two independent side-effects — each isolated so one failing (e.g. a
 * missing vendor email or Resend key) never blocks the other or the order:
 *   1. vendor email notifications (dropship / via-terminal routing)
 *   2. the customer VAT invoice (derives tax from the order's tax lines)
 */
export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const { data: orders } = await query.graph({
    entity: "order",
    filters: { id: data.id },
    fields: [
      "id",
      "display_id",
      "email",
      "currency_code",
      "total",
      "subtotal",
      "tax_total",
      "item_subtotal",
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

  // 1. Vendor notifications — isolated
  try {
    await notifyVendorsWorkflow(container).run({
      input: { order_id: order.id, order },
    })
  } catch (e: any) {
    logger.error(`order-placed — vendor notification failed for #${order.display_id}: ${e.message}`)
  }

  // 2. Customer VAT invoice — isolated
  try {
    const invoice = container.resolve<InvoiceModuleService>(INVOICE_MODULE)
    const email = order.customer?.email || order.email
    await invoice.generateAndSend({
      ...order,
      customer: {
        email,
        first_name: order.customer?.first_name || order.shipping_address?.first_name || "",
        last_name: order.customer?.last_name || order.shipping_address?.last_name || "",
      },
    })
    logger.info(`order-placed — invoice emailed for #${order.display_id}`)
  } catch (e: any) {
    logger.error(`order-placed — invoice failed for #${order.display_id}: ${e.message}`)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
