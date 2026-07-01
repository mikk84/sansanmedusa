# Architecture Review & Quality Audit

**Date:** 2026-06-30 · **Scope:** whole-project architecture, data model, security,
production-readiness.

This is the consolidated audit. It synthesises:
- the **[ADRs](adr/)** (what was decided and why), and
- the **[independent review](independent-review.md)** (a separate critical pass),
each finding below **fact-checked against the running system**.

---

> **Progress update (2026-07-01):** the two CRITICAL items are **resolved** —
> **C1** (montonio/invoice/search now registered + wired; 4,095 products indexed;
> invoice fires on order.placed) and **C2** (EE VAT @ 24%, tax-inclusive; orders
> carry correct tax). Live status tracked in [remediation-plan.md](remediation-plan.md).

## Verdict

The **stack and shape are right**; the **execution is demo-grade in important
places**. Medusa v2 + Next 15 + Meilisearch + Montonio is an appropriate, modern
foundation for a hybrid dropship/terminal store, and the migration work is
genuinely good. But several subsystems the docs describe as "done" are **not
actually wired**, and the central data-model shortcut (`product.metadata`) will
not support production filtering/search. None of this is fatal — it's a clear,
finite list to close before go-live.

**Top 5 to fix before production (in order):**
1. **Register the payment/invoice/search modules** — they exist in code but aren't loaded.
2. **Configure tax** — there is no VAT region/rate; the "22% KM" is currently cosmetic.
3. **Promote brand & vendor out of metadata** to first-class entities/links; project filter facets into Meilisearch.
4. **Harden the `/configure` endpoint** — server-side required-option validation, use `calculated_price`, validate quantity.
5. **Add tests + CI** and fix prod-secret fallbacks.

---

## Findings (fact-checked)

### CRITICAL
**C1 — Payment, invoice, and search modules are not registered.** ✅ Confirmed.
`medusa-config.js` loads only `vendor` + `file`. So the **Montonio provider isn't
active** (checkout uses `pp_system_default`), the **invoice service never runs**,
and **Meilisearch is never indexed or queried** — the "<50ms faceted search" and
auto-invoice described in `docs/architecture.md` don't execute. *This is the
single most misleading gap between docs and reality.* Fix: register the modules,
add an `order.placed` invoice step and a product-upsert search subscriber, then
verify. Effort: M.

**C2 — Tax/VAT is not configured.** ✅ Confirmed (`tax_region` = 0, `tax_rate` = 0).
The storefront prints "Sisaldab 22% KM" and the invoice back-divides by 1.22, but
Medusa computes **0% tax** on the cart/order. For a VAT-registered EE business
this is a compliance problem. Fix: create an EE tax region + 22% inclusive rate;
verify order tax_total and that configured-option surcharges are taxed. Effort: S–M.

### HIGH
**H1 — Configured products bypass Medusa's price/tax/inventory engine.** ✅ Valid
(documented trade-off in [ADR 0005](adr/0005-configurable-products-custom-options.md)).
Custom `unit_price` lines skip tax lines, promotions, and inventory; the
option→price truth is an admin-uneditable JSON blob. Acceptable for SanSan's
no-stock-tracking model, but revisit if VAT-on-surcharge or admin editing matters.

**H2 — `/configure` validation is partial.** ✅ Confirmed
(`api/store/carts/[id]/configure/route.ts`). It does recompute price server-side
(good), but does **not** enforce required options, silently ignores unknown
`value_id`s, doesn't validate `quantity`, and reads raw `price_set` instead of
`calculated_price`. Fix: validate required/known options + quantity; prefer
calculated price. Effort: S.

**H3 — Vendor linkage is a dangling metadata string.** ✅ Valid
([ADR 0004](adr/0004-product-data-model-metadata.md)/[0003](adr/0003-vendor-module-hybrid-oms.md)).
`metadata.vendor_id` has no referential integrity; `retrieveVendor` on a stale id
throws and would fail the whole `order-placed` subscriber. Fix: product↔vendor
**module link** + error isolation in the subscriber. Effort: M.

**H4 — Montonio webhook is not production-safe.** ✅ Valid (provider also not yet
registered, C1). Casing mismatch (`"paid"` route vs `"PAID"` service), no
amount reconciliation, no replay protection, refunds throw. Fix during the real
Montonio integration. Effort: M.

**H5 — Secret fallbacks.** ✅ Confirmed. `jwtSecret`/`cookieSecret` default to
`"supersecret"` in `medusa-config.js`. Fix: require the env vars (fail fast) in
production. Effort: S.

### MEDIUM
- **M1 — No server-side faceted filtering.** ✅ Valid — `metadata` isn't
  filterable; PLP brand/attribute filters are client-side per page. Resolved by
  the data-model work (C3/[ADR 0004](adr/0004-product-data-model-metadata.md)) +
  Meilisearch facets.
- **M2 — Migration not idempotent.** ✅ Valid — category re-import creates
  suffixed duplicates; SKU skips/long-value truncation are silent. Mitigated by
  the documented "clear first" step; add guards + a summary report.
- **M3 — No error isolation in `order-placed`.** ✅ Valid — one bad line item /
  vendor can throw the whole subscriber. Wrap per-vendor sends; make idempotent.
- **M4 — "`medusa build` is broken."** ❌ **Corrected.** The review read a **stale
  note** in `setup-notes.md`; the build was fixed in commit `4d201c1` and
  **passes today** (verified: backend + admin, exit 0). The stale note is now
  updated.
- **M5 — No tests/CI.** ✅ Valid — being addressed (test suite + GitHub Actions).

---

## The data-model question (the deep-dive you asked for)

**Current:** brand, vendor, all attributes, custom options, and stock label live
in `product.metadata` (jsonb). Categories are the one first-class exception.

**Assessment:** fine for rendering a PDP and shipping a demo; **wrong as the
long-term model.** jsonb is opaque to Medusa's query layer, so it's not
filterable, not indexed, has no referential integrity, and isn't admin-editable.
This already forced client-side-only PLP filtering.

**Recommendation (do pre-orders — a re-import is needed anyway):**
1. **Brand → first-class.** A small `brand` module (name, slug, logo) + a
   product↔brand link — enables server-side facets, brand pages, clean slugs.
   (Lighter alternative: Medusa product **type** if strictly one brand/product.)
2. **Vendor → product↔vendor module link** (replaces `metadata.vendor_id`) —
   integrity + OMS queryability.
3. **Filterable attributes → Meilisearch facets** — project the handful of
   filter-worthy metadata keys into the search index; keep Medusa as source of
   truth. Don't try to DB-filter jsonb.
4. **Priced options → consider native variants** for the single-select cases if
   admin editability / tax / inventory become requirements (see
   [ADR 0005](adr/0005-configurable-products-custom-options.md)).
5. Leave purely-informational spec text (warranty, dimensions, install guide) in
   `metadata.attributes`.

---

## What was done well (fair credit)
- Migrating from the **Magento SQL/EAV dump**, not the lossy CSV — preserves
  attribute sets, option labels, the category tree.
- The **HTML-entity decoder** that fixed dropped Estonian ä/ö/õ/ü in descriptions.
- Deliberate **cost-price exclusion** from storefront metadata.
- Honouring Magento's **`is_visible_on_front`** attribute flag.
- Correct instinct to **recompute configured prices server-side** (anti-tamper).
- A clean **vendor module** that matches the business's fulfillment rule.
- An **honest, detailed build log** — which is exactly what made these gaps
  findable.

---

## How to keep verifying quality (process, not one-off)
- **ADRs** ([docs/adr/](adr/)) — decisions are now written down and challengeable.
- **Tests + CI** — turns "verified once by hand" into "verified on every commit".
- **Re-run the independent review** after the data-model rework and before
  go-live; treat `docs/independent-review.md` findings as a closeable checklist.
