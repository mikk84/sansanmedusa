# ADR 0005 — Configurable products via Magento custom options + configurator

**Status:** Accepted (revisit) · 2026-06

## Context
On the old site, "configurable" products are actually Magento **custom options**
on *simple* products (no `catalog_product_super_link` records exist). 1,723
products carry options — drop_down, radio, **checkbox**, **field/text**, area —
with **additive price deltas** on one base SKU/price (e.g. glass tint +23 €,
door width +38 €). SanSan does **not** track per-configuration inventory (they
order from the vendor after payment).

## Decision
Reproduce the Magento behaviour rather than force native Medusa variants:
- Import options into `metadata.custom_options`.
- A PDP **configurator** renders the options and computes a live price.
- Add-to-cart calls a custom route **`POST /store/carts/:id/configure`** that
  **recomputes the price server-side** (anti-tamper) from metadata and adds a
  line item with a custom `unit_price` via `addToCartWorkflow`, recording the
  chosen options in line-item metadata.

## Consequences
**Positive**
- Faithful to the source: handles ALL option types, including checkboxes and
  free-text that the variant model cannot express.
- No variant explosion (a product could otherwise need 30–100+ variants).
- Server-side pricing prevents client tampering; chosen options flow to the order.

**Negative / risks (why "revisit")**
- Sidesteps Medusa's variant machinery: **no per-configuration SKU or inventory**,
  and pricing lives in a bespoke endpoint rather than the price engine.
- **Tax/VAT on the surcharge** relies on Medusa computing tax from the custom
  unit_price — must be verified end-to-end (tax-inclusive EUR, 22%).
- Vendor ordering may eventually need the **per-option vendor codes**
  (`hankija_kood` is per-size on some products) — currently not mapped to the
  configured selection.
- Custom unit_price items are a less-trodden Medusa path; upgrade risk.

## Recommendation
Acceptable for launch given SanSan's no-stock-tracking model. Before scaling:
verify VAT on surcharges; decide whether configured lines need per-option vendor
SKUs for the OMS email; add tests for the pricing math (see test suite).

## Alternatives considered
- **Native Medusa variants per combination.** Loses checkbox/text options;
  combinatorial explosion; needs per-variant prices the source doesn't have.
  Rejected.
- **Hybrid (selects → variants, rest → metadata).** Most faithful to Medusa but
  two code paths and high complexity. Rejected for now.
