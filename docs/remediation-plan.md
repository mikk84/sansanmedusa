# Remediation Plan — pre-production hardening

Work-ready checklist derived from [independent-review.md](independent-review.md)
and the [architecture review](architecture-review.md). Ordered by the review's
sequencing — do phases top to bottom. Each item lists **file(s)**, **effort**
(S ≤ half-day, M ≈ 1–2 days, L ≈ 3–5 days), and **acceptance criteria**.

**Legend:** `[ ]` todo · `[~]` partially done · `[x]` done this session.

---

## Phase 0 — already closed this session
- [x] **M4 — `medusa build` green.** Backend type errors fixed (`4d201c1`); build passes (exit 0).
- [x] **M5 (partial) — tests + CI started.** `configurator-price.ts` + 11 vitest cases; `.github/workflows/ci.yml` runs type-check + tests + `medusa build`. *Remaining:* tests for migration helpers, `/configure`, VAT (see Phase 5).
- [x] **Dependency criticals (security).** Bumped `vitest` to ≥3.2.6 — cleared the 2 critical advisories. *Remaining:* 8 moderate + 2 high transitive `vite` advisories via Medusa (upstream-tracked).

---

## Phase 1 — Truth-up: wire what the docs claim (CRITICAL)
Stop shipping a demo that reads as production.

- [ ] **C1 — Register the `montonio`, `invoice`, `search` modules.** `apps/backend/medusa-config.js:20-42`. **M**
  - Add them to the `modules` array; resolve env options.
  - **Search:** add a `product.created`/`product.updated` subscriber that indexes into Meilisearch; verify `SearchModuleService.setupIndex()` runs and the index populates.
  - **Invoice:** call `InvoiceModuleService.generateAndSend()` from an `order.placed` step (or dedicated subscriber).
  - *Accept:* placing an order produces a Meilisearch-searchable catalog + an emailed invoice; Montonio appears as a payment provider.
- [x] **C2 — Configure EE VAT. DONE.** `apps/backend/src/scripts/tax-setup.ts` (idempotent).
  - Created EE tax region + **24%** rate (EE standard VAT since 2025-07-01, per user); price preferences set **tax-inclusive** (catalog prices are gross).
  - Invoice now derives VAT from the order's **tax lines** (24% fallback only); storefront shows real VAT from `cart.tax_total`; UI strings 22% → 24%.
  - *Verified:* order #2 → gross 202.90 €, net 159.68 €, **VAT 39.27 €** (incl. taxed shipping); `medusa build` green.

## Phase 2 — Data-model remodel (do now, pre-orders — re-import is free)
See [ADR 0004](adr/0004-product-data-model-metadata.md) and the data-model section of the review.

- [ ] **Brand → first-class entity.** `import-magento.ts` + new `brand` module (or product-category/collection). **M**
  - Model brand (name, slug, logo); link products; populate on import.
  - *Accept:* server-side brand facet on PLP; brand dedupe ("Grohe" vs "GROHE" impossible); admin-editable.
- [ ] **Vendor → product↔vendor module link.** `defineLink(Product, Vendor)`; populate on import; stamp `vendor_id` onto the **line item** at add-to-cart. `import-magento.ts:341-356`, cart flow. **M**
  - *Accept:* "all products for vendor X" is a query, not a JSON scan; orders carry an immutable vendor id; deleting a vendor can't dangle silently.
- [ ] **Priced options → native Medusa variants** where the option is a real priced choice (size/finish); keep custom-line only for free-text. `configure/route.ts`, `import-magento.ts` custom-options. **L**
  - *Accept:* configured size/finish becomes a real variant with price/tax/inventory/admin editing; `/configure` custom-line path shrinks to engraving-style inputs.
  - > If deferring: at minimum move `custom_options` out of `metadata` into a real table.

## Phase 3 — Security & payment hardening
(Full detail in [security-audit.md](security-audit.md).)

- [ ] **H5 — Remove insecure secret/CORS fallbacks.** `medusa-config.js:8-14`. **S**
  - Throw on missing `JWT_SECRET`/`COOKIE_SECRET`/CORS in non-dev (fail fast).
- [ ] **H2 — Harden `/configure` validation.** `api/store/carts/[id]/configure/route.ts:67-103`. **S**
  - Enforce all required options present; reject unknown `option_id`/`value_id` (400, don't silently skip); validate `quantity` is a positive int; bound max surcharge; read base from `calculated_price`.
- [ ] **H4 — Montonio webhook safety.** `montonio/service.ts:117-141`, `api/hooks/payment/montonio/route.ts`. **M**
  - Verify decoded **amount/currency/reference** match the payment session; one status path (provider `getWebhookActionAndData`); normalize status casing; add replay protection (store processed jti/reference); implement `refundPayment`.

## Phase 4 — OMS reliability & correctness
- [ ] **H3/M3 — Order subscriber resilience.** `subscribers/order-placed.ts`, `workflows/notify-vendors.ts`. **S–M**
  - try/catch per-vendor send; record send status on the order; idempotent on retry; guard `retrieveVendor` against missing vendors.
- [ ] **L6 — Don't email vendors with empty addresses.** `import-magento.ts:262`, notify workflow. **S**
  - Validate vendor email before `resend.emails.send`; surface "missing email" to admin.
- [ ] **Two-step via-terminal fulfillment** (warehouse-received → shipped state machine) described in `oms-vendor-flow.md` but **not built**. **L**
  - *Accept:* a via-terminal order can be marked received-at-warehouse then shipped onward, distinct from dropship.

## Phase 5 — Migration robustness & test depth
- [ ] **M2 — Migration idempotency + manifest.** `import-magento.ts` (categories `:196-237`, dedupe `:314-327`, truncation `:359`). **M**
  - Idempotent category import (map by Magento entity_id); emit a manifest of skipped SKUs + failed batches; stop silently truncating >800-char values.
- [ ] **M5 (finish) — broaden tests.** **M**
  - Unit: `decodeEntities`, `toAmount`, `buildDisplayAttributes`, vendor grouping. Integration: `/configure` price+validation, VAT on an order.
- [ ] **L1 — Image URLs portable for R2.** `attach-images.ts:35,120`. **S**
  - Store relative paths + a configurable base; add a one-shot URL-rewrite for the R2 cutover.
- [ ] **L3 — Stock signal not string-sniffed.** `medusa.ts:65` (`in_stock` from label containing "tellim"). **M**
  - Use a real inventory level or an enum, not substring matching.
- [ ] **L5 — Fail clearly on missing publishable key.** `medusa.ts:16`, `store-client.ts:11`. **S**

---

## Suggested order for tomorrow
Start with **Phase 1 (C1 + C2)** — highest impact, unblocks honesty + VAT
correctness. Then **Phase 2** while the DB only holds the catalog. Phases 3–5
can interleave. Treat a green CI (`medusa build` + tests) as the release gate.
