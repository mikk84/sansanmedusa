import {
  createWorkflow,
  createStep,
  StepResponse,
} from "@medusajs/framework/workflows-sdk"
import { VENDOR_MODULE } from "../modules/vendor"
import { Resend } from "resend"

type NotifyVendorsInput = {
  order_id: string
  order: {
    id: string
    display_id: number
    customer: { first_name: string; last_name: string; email: string }
    shipping_address: {
      address_1: string
      city: string
      postal_code: string
      country_code: string
      phone?: string
    }
    items: Array<{
      id: string
      title: string
      quantity: number
      unit_price: number
      metadata?: {
        vendor_id?: string
        vendor_sku?: string  // hankija_kood from Magento
      }
    }>
  }
}

// ── Step 1: Group order line items by vendor ──────────────────────────────────
const groupItemsByVendor = createStep(
  "group-items-by-vendor",
  async (input: NotifyVendorsInput, { container }) => {
    const vendorService = container.resolve(VENDOR_MODULE)

    const vendorGroups = new Map<string, {
      vendor: any
      items: NotifyVendorsInput["order"]["items"]
    }>()

    for (const item of input.order.items) {
      const vendorId = item.metadata?.vendor_id
      if (!vendorId) continue

      if (!vendorGroups.has(vendorId)) {
        const vendor = await vendorService.retrieveVendor(vendorId)
        vendorGroups.set(vendorId, { vendor, items: [] })
      }
      vendorGroups.get(vendorId)!.items.push(item)
    }

    return new StepResponse({ vendorGroups: Object.fromEntries(vendorGroups) })
  }
)

// ── Step 2: Send one email per vendor ────────────────────────────────────────
const sendVendorEmails = createStep(
  "send-vendor-emails",
  async (
    {
      vendorGroups,
      order,
    }: { vendorGroups: Record<string, any>; order: NotifyVendorsInput["order"] },
    { container }
  ) => {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const results: string[] = []

    for (const [vendorId, { vendor, items }] of Object.entries(vendorGroups)) {
      const isDropship = vendor.fulfillment_type === "dropship"

      const deliveryAddress = isDropship
        ? formatCustomerAddress(order.shipping_address, order.customer)
        : formatTerminalAddress(vendor.terminal_address)

      const itemRows = items
        .map(
          (item: any) =>
            `  • ${item.metadata?.vendor_sku || "—"} — ${item.title} × ${item.quantity}`
        )
        .join("\n")

      const subject =
        vendor.email_language === "en"
          ? `SanSan order #${order.display_id} — your items`
          : `SanSan tellimus #${order.display_id} — teie tooted`

      const body =
        vendor.email_language === "en"
          ? buildEnglishEmail(order, deliveryAddress, itemRows, isDropship)
          : buildEstonianEmail(order, deliveryAddress, itemRows, isDropship)

      await resend.emails.send({
        from: process.env.EMAIL_FROM || "tellimused@sansan.ee",
        to: vendor.email,
        subject,
        text: body,
      })

      results.push(`Notified ${vendor.name} (${vendor.email})`)
    }

    return new StepResponse({ results })
  }
)

// ── Workflow ──────────────────────────────────────────────────────────────────
export const notifyVendorsWorkflow = createWorkflow(
  "notify-vendors",
  (input: NotifyVendorsInput) => {
    const { vendorGroups } = groupItemsByVendor(input)
    const { results } = sendVendorEmails({ vendorGroups, order: input.order })
    return { results }
  }
)

// ── Email templates ───────────────────────────────────────────────────────────
function buildEstonianEmail(
  order: any,
  deliveryAddress: string,
  itemRows: string,
  isDropship: boolean
): string {
  const destination = isDropship ? "otse kliendile" : "meie lattu"
  return `Tere,

Palun saatke järgmised tooted ${destination}:

TARNE AADRESS:
${deliveryAddress}

TOOTED:
${itemRows}

Tellimuse number: #${order.display_id}
Kliendi e-post: ${order.customer.email}

Palun kinnitage tellimuse kättesaamine vastuskirjaga ja teavitage meid saadetise jälgimisnumbrist.

Lugupidamisega,
SanSan OÜ
tellimused@sansan.ee
Tel: +372 6 406 405`
}

function buildEnglishEmail(
  order: any,
  deliveryAddress: string,
  itemRows: string,
  isDropship: boolean
): string {
  const destination = isDropship ? "directly to the customer" : "to our warehouse"
  return `Hello,

Please ship the following items ${destination}:

DELIVERY ADDRESS:
${deliveryAddress}

ITEMS:
${itemRows}

Order reference: #${order.display_id}
Customer email: ${order.customer.email}

Please confirm receipt of this order and provide a tracking number when available.

Best regards,
SanSan OÜ
tellimused@sansan.ee
Tel: +372 6 406 405`
}

function formatCustomerAddress(address: any, customer: any): string {
  return [
    `${customer.first_name} ${customer.last_name}`,
    address.address_1,
    `${address.postal_code} ${address.city}`,
    address.country_code?.toUpperCase() || "EE",
    address.phone ? `Tel: ${address.phone}` : "",
  ]
    .filter(Boolean)
    .join("\n")
}

function formatTerminalAddress(terminalAddress: any): string {
  if (!terminalAddress) {
    return "SanSan OÜ\n[Warehouse address not configured — set in vendor settings]"
  }
  return [
    "SanSan OÜ",
    terminalAddress.address_1,
    `${terminalAddress.postal_code} ${terminalAddress.city}`,
    terminalAddress.country_code?.toUpperCase() || "EE",
  ]
    .filter(Boolean)
    .join("\n")
}
