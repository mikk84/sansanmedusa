import { model } from "@medusajs/framework/utils"

/**
 * Vendor — a supplier SanSan orders from after a customer has paid.
 *
 * fulfillment_type drives two distinct flows in the OMS:
 *   dropship    → vendor ships directly to the customer's address
 *   via_terminal → vendor ships to SanSan warehouse; SanSan ships onward
 *
 * This flag is set once per vendor and never changes per-order.
 */
export const Vendor = model.define("vendor", {
  id: model.id().primaryKey(),
  name: model.text(),
  email: model.text(),
  phone: model.text().nullable(),
  fulfillment_type: model.enum(["dropship", "via_terminal"]).default("dropship"),

  // SanSan's own delivery address — used in via_terminal vendor emails
  terminal_address: model.json().nullable(),

  // Optional: vendor's preferred language for order emails (et | en)
  email_language: model.enum(["et", "en"]).default("et"),

  notes: model.text().nullable(),
  is_active: model.boolean().default(true),
  // created_at and updated_at are implicit on every Medusa model — do not declare them
})
