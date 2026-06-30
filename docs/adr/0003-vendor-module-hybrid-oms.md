# ADR 0003 — Custom vendor module for hybrid dropship / via-terminal OMS

**Status:** Accepted · 2026-06

## Context
SanSan's fulfillment is **vendor-based**: each of ~20–30 suppliers either
drop-ships to the customer or ships to SanSan's terminal (then SanSan forwards).
SanSan orders from the vendor **after** the customer has paid. The system must
route each paid order's line items to the right vendor with the right delivery
address and notify the vendor.

## Decision
A **custom Medusa module** `vendor` with a `Vendor` model carrying
`fulfillment_type: "dropship" | "via_terminal"`, contact, terminal address, and
email language. On `order.placed`, a subscriber triggers a **`notify-vendors`
workflow** that groups line items by vendor (`vendor_id` carried in line-item /
product metadata) and emails each vendor the correct address (customer for
dropship, SanSan warehouse for via-terminal) via Resend.

## Consequences
**Positive**
- Uses Medusa's intended extension points (module + workflow + subscriber).
- Fulfillment rule lives in one place (the vendor record), matching the business rule.

**Negative / risks**
- Vendor linkage currently rides in **product `metadata`** (`vendor_id`), not a
  proper module link — so it isn't relationally enforced or easily queryable
  (see [ADR 0004](0004-product-data-model-metadata.md)). Promoting it to a
  product↔vendor **module link** would be more robust.
- The notify-vendors workflow is built but **not yet tested against a real order**.
- No retry/idempotency story yet if vendor email fails.

## Alternatives considered
- **Medusa's native fulfillment providers per vendor.** Heavier; the OMS need is
  really "route + notify," not shipping-rate computation. The custom module is
  lighter and more direct. Revisit if real carrier integration is needed.
