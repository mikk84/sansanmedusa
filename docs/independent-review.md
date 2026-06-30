# Independent Architecture & Data-Model Review — SanSan

**Reviewer:** Independent senior commerce architect (critical audit, no rubber-stamping)
**Date:** 2026-06-30
**Scope:** data model, whole-stack fit, configurable-product approach, Medusa v2 conformance, security, migration scripts, tech debt.
**Method:** read all docs + the backend (modules, scripts, workflows, subscribers, API routes, config) and the storefront data/cart/checkout layer. No source code was modified.

---

## Executive summary

The foundation is **promising but not yet sound**. The team made several genuinely good calls — Medusa v2 is the right class of system for a hybrid-fulfillment OMS, the Magento migration is thoughtful (EAV-from-SQL, entity decoding, cost-price exclusion, frontend-visibility honoured), and server-side recomputation of configured prices is the correct instinct. But the project is currently a working **demo**, and several decisions that look finished in the docs are not actually wired up, plus the central data-model choice (everything in `product.metadata`) will actively block the catalog/search/filtering requirements as soon as you move past the homepage.

The single most consequential decision — storing brand, attributes, vendor linkage, options and stock inside an opaque JSON `metadata` blob — is the wrong long-term model and is already costing you. It is not queryable, not filterable at the DB layer, not indexed, has no referential integrity (vendor_id is a dangling string), and breaks the faceted PLP/search the client explicitly needs. This should be addressed before more features are layered on top.

**Top 5 things to address, in order:**

1. **Wiring gaps that contradict the docs (CRITICAL).** The `montonio`, `invoice`, and `search` modules are **not registered** in `medusa-config.js`. The invoice service is **never called** by any subscriber. The Meilisearch index is **never created or populated** (no indexing subscriber, `setupIndex` is dead code). The architecture diagram and OMS docs describe a payment/invoice/search pipeline that does not run. Either build it or stop claiming it works.
2. **Data model: move brand, vendor, options off `metadata`** to first-class entities / native variants / a real module link. (See dedicated section.)
3. **Configurable-products approach is structurally fragile (HIGH).** Custom `unit_price` line items bypass Medusa's price/tax/promotion engine and have **zero inventory linkage**. The `/configure` endpoint has real validation holes (missing required options not enforced server-side, percent-on-percent base, no max/min, integer-overflow-style trust of client value_ids).
4. **Tax is fake (HIGH).** There is no tax region, no tax rate, no `is_tax_inclusive` setting anywhere in source. The storefront prints "Sisaldab 22% käibemaksu" and the invoice back-calculates 22% from the gross — but Medusa itself is computing **0% tax**. For an Estonian VAT-registered business this is a compliance problem, not a cosmetic one.
5. **Secrets & security hardening (HIGH/MEDIUM).** JWT/cookie secrets fall back to `"supersecret"`; the Montonio webhook trusts `payment_status` casing inconsistently and the amount is never reconciled against the cart; refunds throw.

---

## Findings by severity

### CRITICAL

#### C1. Core modules are not registered — documented subsystems don't run
- **File:** `apps/backend/medusa-config.js:20-42` (only `vendor` + `file` modules registered)
- **Problem:** `montonio`, `invoice`, and `search` modules exist under `src/modules/` but are absent from the `modules` array. A Medusa module that isn't in config is never loaded, so:
  - The Montonio payment provider is not available to the payment module (checkout hardcodes `pp_system_default` anyway — `CheckoutClient.tsx:16`).
  - `InvoiceModuleService` is never resolved or called — `grep` shows only `notify-vendors` is invoked from the single subscriber. The "Invoice (automatic)" step in `oms-vendor-flow.md` does not happen.
  - `SearchModuleService.setupIndex()` is dead code; there is **no `product-indexed` subscriber** (the only subscriber is `order-placed.ts`). Meilisearch is never populated, so the "<50ms faceted search" the README sells does not exist.
- **Why it matters:** The docs (`architecture.md`, `oms-vendor-flow.md`, `README.md`) present these as built and verified. A reviewer/stakeholder reading the docs would believe payments, VAT invoices, and search are working. They are not.
- **Recommendation:** Register the modules, add the indexing subscriber, and wire the invoice generation into the `order-placed` flow (or a dedicated subscriber). Until then, mark these explicitly as "scaffolded, not wired" in the docs.
- **Effort:** M

#### C2. No tax configuration — VAT is effectively 0% in the engine
- **File:** entire backend; confirmed absence via grep for `is_tax_inclusive` / `tax_rate` / `automatic_taxes` (only hits are in compiled admin `dist/` bundles). `checkout-setup.ts` creates region/shipping/payment links but **no tax region or rate**. `invoice/service.ts:49-55` divides the gross by 1.22 to fabricate VAT.
- **Problem:** Medusa computes order tax from tax regions/rates. With none configured, every order's tax total is 0. The UI string "Sisaldab 22% käibemaksu" (`CheckoutClient.tsx:267`) and the invoice's back-derived VAT are both **decorative** — they don't reflect what Medusa stored on the order. There is also no decision recorded on whether migrated prices are gross (incl. VAT) or net; the invoice assumes gross, the engine assumes net-with-0%-tax. These cannot both be right.
- **Why it matters:** SanSan is VAT-registered in Estonia. Order records, accounting exports, and refunds will all carry wrong tax. This is a legal/financial correctness issue, not UX.
- **Recommendation:** Create an EE tax region with a 22% rate, decide and document gross-vs-net (Estonian B2C storefronts are conventionally tax-inclusive → set `is_tax_inclusive` on the region and import prices as gross), and derive invoice VAT from the order's tax lines, not a hardcoded divide.
- **Effort:** M

---

### HIGH

#### H1. Configurable products bypass the pricing/inventory/tax engine
- **File:** `apps/backend/src/api/store/carts/[id]/configure/route.ts:89-103`
- **Problem:** The route computes a `unit_price` in JS and injects it via `addToCartWorkflow`. Custom unit prices:
  - **skip tax calculation** (compounding C2 — even once tax exists, a custom-priced line may not be taxed consistently),
  - **skip promotions/price lists** (any future discount engine won't see these lines correctly),
  - have **no inventory record** — the option permutations aren't variants, so stock for a configured combination is unmanaged (acceptable today because `manage_inventory:false`, but it forecloses ever tracking stock per configuration),
  - **lose the option↔price relationship at the catalog layer** — the only source of truth for what an option costs is the JSON blob in `metadata.custom_options`, which the admin cannot edit through any UI.
- **Why it matters:** This is the mechanism for ~1,723 products. It works for the happy path but fights Medusa at every adjacent feature (tax, promos, inventory, admin editing).
- **Recommendation:** For options that are genuinely *priced choices* (size, finish), model them as native Medusa **product options + variants** — that is exactly what Medusa variants are for, and it gives you real prices, tax, inventory, and admin editing for free. Reserve the custom-line mechanism only for free-text/engraving-style inputs that truly can't be variants. If you keep the custom-line approach short-term, at minimum move `custom_options` out of metadata into a real table (see data-model section).
- **Effort:** L (variant remodel) / M (harden current approach)

#### H2. `/configure` server-side validation holes (price integrity)
- **File:** `configure/route.ts:67-103`
- **Problems:**
  1. **Required options are not enforced server-side.** The client (`ProductBuyBlock.tsx:44-49`) checks `missingRequired`, but the route never validates that all `required` options have a selection. A crafted request can add a "required-choice" product with no choices and a bare base price.
  2. **No validation that submitted `value_id`s belong to the option, beyond a silent `find`** — unknown ids are ignored (`applyValue` returns), so a partial/garbage payload still creates a line at an under-priced amount with misleading `configured_options` metadata.
  3. **Percent deltas use the bare `base`**, and multiple percent options stack additively on the same base — fine if intended, but undocumented and untested; combined with free-text option-level `price` (line 83) there's no max-surcharge or sanity bound.
  4. **`quantity` is untrusted** (no positive-integer check) and flows straight into the workflow.
  5. The endpoint resolves prices via `price_set.prices` directly (line 56-58), not `calculated_price`, so it will diverge from any price list / sale logic later.
- **Why it matters:** The whole point of the route is anti-tamper. It prevents the *client setting the price directly*, but it does **not** guarantee a valid, fully-specified configuration at the correct total. An attacker controls which deltas apply.
- **Recommendation:** Validate the full selection set server-side (all required present, every `value_id`/`option_id` belongs to the product, quantity is a positive int, surcharge within bounds), reject (400) on any mismatch instead of silently skipping, and read base price from `calculated_price`.
- **Effort:** S

#### H3. Vendor linkage has no referential integrity
- **File:** `import-magento.ts:341-356` (`metadata.vendor_id`); `notify-vendors.ts:48-57`; no `defineLink` anywhere (grep for module links returns nothing).
- **Problem:** `vendor_id` is stored as a plain string in product metadata, with no module link between the Product and Vendor modules. Consequences:
  - Deleting/merging a vendor leaves **dangling ids** on thousands of products; nothing enforces existence.
  - You cannot query "all products for vendor X" without scanning every product's JSON.
  - The OMS workflow does `retrieveVendor(vendorId)` per item (`notify-vendors.ts:54`) and will **throw on a stale id**, failing the whole order-placed subscriber (and there's no try/catch around the workflow).
  - At order time, vendor info is copied into **line-item metadata** at add-to-cart? Actually it is read from product metadata at order time via `items.metadata` — but the importer only puts `vendor_id` on the *product*, and line items copy product metadata inconsistently. The flow that gets `vendor_id` onto the line item is not shown anywhere; if it relies on Medusa auto-copying product metadata to line items, that is not guaranteed and should be verified.
- **Why it matters:** Vendor routing is the core OMS requirement. Building it on an unenforced string reference is fragile exactly where reliability matters most (post-payment fulfillment).
- **Recommendation:** Create a real module link (`defineLink(ProductModule.linkable.product, VendorModule.linkable.vendor)`), populate it during import, and stamp `vendor_id` explicitly onto line items at add-to-cart time (so it's immutable on the order even if the product later changes vendor). Guard the subscriber/workflow against missing vendors.
- **Effort:** M

#### H4. Montonio webhook: no amount reconciliation, inconsistent status casing, auth concerns
- **File:** `montonio/service.ts:117-141`, `api/hooks/payment/montonio/route.ts:26-34`
- **Problems:**
  - **Amount is never verified against the cart/order.** The webhook authorizes the session on `payment_status === "paid"` without confirming `grand_total` matches the expected amount. A replayed or mismatched token could authorize an underpaid order.
  - **Status casing is inconsistent:** the route checks `payload.payment_status !== "paid"` (lowercase) while `getWebhookActionAndData` checks `"PAID"` (uppercase). One of these is wrong against the real Montonio payload; today neither path is exercised because the module isn't even loaded (C1).
  - The webhook route resolves `"payment"` and calls `authorizePaymentSession` directly, partially bypassing the provider's own `getWebhookActionAndData` contract — two competing code paths for the same event.
  - **JWT uses the secret key as an HMAC signing secret** (`HS256`) for the *outbound* order token (`service.ts:45-60`). Montonio's real integration uses the access key as identifier and the secret for signing — verify this matches their current API; the 10-minute `exp` on the order token is fine, but there's no idempotency/replay protection on the inbound webhook.
- **Why it matters:** Payment authorization is the trust boundary between "customer paid" and "we order from vendors and ship." Authorizing without amount/idempotency checks risks fulfilling unpaid/underpaid orders.
- **Recommendation:** On webhook, verify signature **and** that the decoded amount/currency/reference match the payment session; pick one status path (the provider's `getWebhookActionAndData`); normalize status casing against Montonio's documented payload; add replay protection (store processed token jti / reference). Implement `refundPayment` against Montonio's refund API rather than throwing.
- **Effort:** M

#### H5. Secrets default to insecure literals
- **File:** `medusa-config.js:13-14` — `jwtSecret`/`cookieSecret` fall back to `"supersecret"`.
- **Problem:** If `JWT_SECRET`/`COOKIE_SECRET` aren't set in an environment, the app boots with a publicly-known secret. `.env.example` documents real ones, but the fallback means a misconfigured prod still starts (silently insecure) instead of failing fast.
- **Why it matters:** Predictable JWT secret = forgeable admin/customer sessions.
- **Recommendation:** Remove the fallbacks; throw on missing secrets in non-dev. Same for `STORE_CORS`/`ADMIN_CORS` (defaulting admin CORS to `localhost:9000` will silently break/over-permit in prod).
- **Effort:** S

---

### MEDIUM

#### M1. Faceted PLP filtering is impossible against the current data shape
- **File:** `apps/storefront/src/lib/medusa.ts` (no brand/price/attribute filtering); `setup-notes.md` describes a filter sidebar built against `sample-data.ts`.
- **Problem:** Brand and attributes live in `metadata`, which the Store Products API cannot filter or facet on. The PLP "filter by brand / price / subcategory" described in the design can only be implemented by either (a) fetching all products and filtering client-side (doesn't scale, breaks pagination) or (b) going through Meilisearch (not wired — C1). There is currently no working server-side facet path.
- **Recommendation:** Make brand a first-class entity (or at least an indexed column / dedicated relation) and drive PLP filtering through Meilisearch once it's populated. See data-model section.
- **Effort:** M (depends on data-model decision)

#### M2. Migration idempotency & re-run hazards
- **File:** `import-magento.ts:196-237` (categories), `:314-327` (product dedupe)
- **Problems:**
  - Category creation is explicitly **not idempotent** — re-running creates suffixed duplicates (documented, but it's a foot-gun: a partial failure mid-import leaves a half-built tree that a re-run corrupts further).
  - Product dedupe is by **variant SKU**; products with empty/duplicate Magento SKUs are silently skipped (`skipped++`), with no report of *which* were dropped — silent data loss.
  - Batch failures (`:404-407`) are caught and logged but the run reports "DONE"; a batch of 100 failing loses 100 products with only a truncated error list (first 5).
  - `metadata` drops any string attribute > 800 chars (`:359`) silently — long spec values vanish with no trace.
- **Recommendation:** Make category import idempotent (match by Magento entity_id → store the mapping), emit a manifest of skipped SKUs and failed batches, and don't silently truncate.
- **Effort:** M

#### M3. `order.placed` subscriber has no error isolation
- **File:** `subscribers/order-placed.ts:32-34`
- **Problem:** A single failing vendor (`retrieveVendor` throws on a stale id — see H3) or a Resend outage throws out of the workflow, and the subscriber has no catch. Depending on Medusa's event retry config this either silently drops vendor notifications or retries the whole thing (duplicate emails).
- **Recommendation:** Wrap per-vendor sends in try/catch, record send status on the order (so the admin "✉ Email sent" UI in the docs has real data behind it), and make the workflow idempotent for retries.
- **Effort:** S

#### M4. `medusa build` is known-broken (type errors)
- **File:** `setup-notes.md:114-120` (self-reported)
- **Problem:** Production build fails type-check (Montonio signatures, Meilisearch casing, workflow return types). Dev works via `transpileOnly`. This means the production artifact has never type-checked clean — exactly the modules with the most `any` (Montonio, search) are the unverified ones.
- **Recommendation:** Fix before any deploy; treat a green `medusa build` as a release gate. The pervasive `any` typing across services/routes (`vendorService: any`, `req.body as any`, workflow inputs) is what let these slip.
- **Effort:** M

#### M5. No tests, no CI
- **File:** repo-wide (no `*.test.ts`, empty `.github/workflows`)
- **Problem:** Zero automated tests around the parts most likely to break and most costly to get wrong: price computation in `/configure`, VAT, vendor grouping, migration helpers (entity decode, slugify, price parsing). No CI to catch the broken build (M4).
- **Recommendation:** Start with unit tests on the pure functions (`decodeEntities`, `toAmount`, surcharge math) and an integration test on `/configure` price/validation. Add a CI job running `medusa build` + tests.
- **Effort:** M

---

### LOW

- **L1. `attach-images.ts` serves images off `localhost:9000/static`** baked into product records (`:35,120`). When you move to R2, every product row's `thumbnail`/`images` URLs are stale and need a rewrite migration. Store relative paths + a configurable base instead. (S)
- **L2. `medusa-config.js` over `.ts`** is a reasonable workaround but means the config isn't type-checked; document the constraint inline. (S)
- **L3. Stock status is a free-text label** (`metadata.stock_label`, with the storefront inferring `in_stock` from whether the label contains "tellim" — `medusa.ts:65`). Brittle string-sniffing for a core commerce signal; should be a real inventory level or at least an enum. (M)
- **L4. `nodeLinker: hoisted`** is the documented Medusa+pnpm path, but it defeats pnpm's isolation guarantees (phantom-dependency risk). Acceptable given Medusa's admin bundler, just noting the tradeoff. (—)
- **L5. Publishable key default is `""`** in both storefront clients (`medusa.ts:16`, `store-client.ts:11`) — a missing key yields opaque 400s rather than a clear boot error. (S)
- **L6. `email: ""`** is set on every imported vendor (`import-magento.ts:262`); the OMS will attempt `resend.emails.send({ to: "" })` and throw for any vendor whose email wasn't filled in via admin. Validate before sending. (S)

---

## The metadata-vs-first-class-entity question (data-model deep-dive)

**Current state:** brand, vendor id/name/sku, attribute set, stock label, every visible attribute, the full custom-options spec, and a pre-rendered display-attribute list are all stuffed into `product.metadata` (`import-magento.ts:346-366`). `metadata` is a single `jsonb` column.

**This is the wrong model for everything past the demo. Concretely, it breaks:**

| Requirement | Why metadata fails |
|---|---|
| **Faceted PLP filtering** (brand, price, attributes) | `jsonb` keys aren't exposed by the Store API for filtering; you can't `WHERE metadata->>'brand' = ?` through Medusa's query layer, and even raw SQL on `jsonb` has no useful index here. |
| **"All products by vendor X"** | Full-table JSON scan; no index, no join. |
| **Referential integrity** | `vendor_id` is a dangling string (H3). Brand likewise — typos/renames create silent duplicates ("Grohe" vs "GROHE"). |
| **Admin editing** | Staff cannot edit brand/options/attributes through the Medusa admin — they're invisible JSON. Every change is a script re-run. |
| **Search relevance & weighting** | Meilisearch needs structured, filterable attributes; you'd re-flatten the JSON into the index anyway, so the JSON is just a lossy intermediate. |
| **Reporting / BI** | Anything analytical (sales by brand, by vendor, by attribute) requires JSON extraction gymnastics. |

**Recommendation — promote three things to first-class:**

1. **Brand → a real entity** (small custom `brand` module, or Medusa product-category/collection if you don't need brand pages). 79 brands, queried and filtered constantly. Link products to it. Gives you brand pages, clean facets, dedupe, and admin editing.
2. **Vendor → a module link, not a metadata string** (H3). The Vendor module already exists; add `defineLink(Product, Vendor)` and populate during import. Stamp the vendor id onto the line item at add-to-cart so orders are immutable.
3. **Priced options → native Medusa product options + variants** (H1) wherever the option is a real priced choice (size/finish). This is the single biggest win: you get DB-level structure, real prices, tax, inventory, promotions, and admin editing for free, and you stop maintaining a parallel pricing engine in `/configure`. Keep custom-line handling only for genuine free-text inputs.

**What can reasonably stay in metadata:** purely descriptive, display-only spec attributes that are never filtered or sorted on (installation-guide links, free-text spec sentences). That's a legitimate use of `metadata`. The mistake is putting *queryable/relational* data there.

**Migration cost is real but front-loaded.** You're re-running the importer anyway (it's not idempotent). Doing the brand-entity + vendor-link + variant remodel now, while the catalog is the only thing in the DB and there are no real orders, is dramatically cheaper than after go-live.

---

## Whole-stack sanity check

**Is Medusa v2 the right backbone? Yes, with caveats.** For a hybrid dropship/terminal OMS with order-after-payment and 4k products, Medusa v2 gives you an admin, orders, returns, fulfillment primitives, and an extensible module system — building that from scratch (the "no PHP/WordPress" constraint rules out Magento successors) would be far more work. The vendor-based fulfillment rule maps cleanly onto a custom module. Next.js 15 + Meilisearch + Montonio + Resend are all sensible, proportionate choices for the Estonian market and the stated scale.

**Where the approach fights the framework:**
- The **custom-priced line item** for configurables (H1) is the clearest case of swimming against the current — Medusa *wants* you to use variants; the metadata+`unit_price` path reimplements pricing badly and loses tax/inventory/promos.
- **Order-after-payment** is fine and idiomatic (authorize on webhook), but the implementation reconciles nothing (H4).
- **Two-step via-terminal fulfillment** (docs §5) is described but I see **no code** implementing the warehouse-received → shipped state machine; today it's a manual-fulfillment demo. That's the hardest OMS requirement and it isn't built yet — the docs over-state completion.

**Decision I'd reverse / revisit:**
- Don't model priced options as metadata custom-options → use variants (H1).
- Don't ship without tax regions (C2) — it's not optional for a VAT business.
- Reconsider whether `invoice`-as-HTML-attachment is acceptable to the client's accountant vs. a real PDF with sequential, gap-free numbering (the current `SS-YYMM-{display_id}` numbering is tied to Medusa display_id, which can have gaps — Estonian invoicing generally wants a controlled sequence).

**Nothing here suggests abandoning the stack.** The bones are right; the gap is between what the docs claim is done and what's actually wired, plus the data-model shortcut.

---

## What was done well (credit where due)

- **Migrating from the Magento SQL/EAV dump rather than the flattened CSV** is the correct, more-faithful choice and shows real understanding of Magento's model (attribute sets, option-label resolution, category tree with parent hierarchy).
- **The entity decoder** (`import-magento.ts:511-543`) is a genuinely good fix — catching that `stripHtml` was eating Estonian ä/ö/ü via HTML entities, and handling named + numeric + zero-width, is careful work.
- **Cost price is deliberately and correctly excluded** from metadata and display (`SYSTEM_ATTRS` includes `cost`) — the one piece of data that must never leak is handled with intent.
- **Honouring Magento's `is_visible_on_front` flag** (`buildDisplayAttributes:467`) so hidden internal attributes don't surface is a nice touch most migrations miss.
- **Server-side price recomputation for configured products is the right instinct** (even if the validation needs hardening) — they understood the client must never set the price.
- **The vendor module models the real business rule** (`fulfillment_type` per vendor, terminal address, email language) cleanly and matches the OMS requirement.
- **Honest, detailed build log** (`setup-notes.md`) — documenting the `nodeLinker: hoisted` saga, the known-broken `medusa build`, and the demo-vs-real payment state is exactly the transparency a reviewer wants; it's how I could distinguish "demo" from "done."
- **Sensible infra proportionality** — Meilisearch self-hosted, a €4 Hetzner box for the stated scale, R2 for images with no 9.8GB duplication via symlink. No premature over-engineering.

---

## Suggested sequencing

1. **Truth-up the docs / register modules** (C1) and **add tax** (C2) — stop shipping a demo that reads as production.
2. **Data-model remodel** (brand entity, vendor link, variants for priced options) — do it now, pre-orders, while a re-import is free.
3. **Harden `/configure`** (H2) and the **Montonio webhook** (H4); remove secret fallbacks (H5).
4. **Wire search indexing + invoice generation**, build the **two-step terminal fulfillment** that the OMS docs promise.
5. **Tests + CI + green `medusa build`** as the release gate.
