# ADR 0004 — Product attributes / brand / options in product `metadata`

**Status:** Accepted (revisit) · 2026-06

> This is the most load-bearing data-model decision in the project. It is
> deliberately flagged **revisit** — see the trade-offs below.

## Context
Magento's catalog is EAV: ~136 product attributes, attribute sets, brand
(`tootja`), supplier (`hankija`), custom options, stock labels, etc. The
migration needed somewhere to put all of this in Medusa. Medusa's first-class
product fields are limited (title, handle, description, options/variants,
categories, type, collection, tags); everything else has to go somewhere.

## Decision
Store migrated catalog data in the Medusa product **`metadata`** JSON column:
- `metadata.brand`, `metadata.attributes` (display list), `metadata.custom_options`
  (configurator), `metadata.vendor_id` / `vendor_name` / `vendor_sku`,
  `metadata.stock_label`, `metadata.attribute_set`, plus raw attribute codes.
- Categories are migrated to **first-class** Medusa categories (the one exception).
- Price → variant price set; cost is **excluded** from metadata (never exposed).

## Consequences
**Positive**
- Fast to implement; preserved the entire Magento attribute richness without
  modelling 136 attributes as columns/entities up front.
- Flexible — new attributes need no schema change.
- Good enough to render the PDP (attributes, brand, configurator) and the cart.

**Negative / risks (why "revisit")**
- **Not natively queryable / filterable / indexable.** `metadata` is an opaque
  jsonb blob to Medusa's query layer. This already forced the PLP **brand and
  attribute filters to be client-side over the current page only** — there is no
  efficient server-side facet on `metadata.brand`. Faceted filtering at catalog
  scale will not work well this way.
- **Brand is a string, not an entity.** No brand pages, logos, canonical slugs,
  or referential integrity; "Duschy" vs "duschy" drift is possible.
- **Vendor linkage is a metadata string id**, not a module link — no relational
  guarantee, weaker for OMS queries ("all unfulfilled items for vendor X").
- **Search** (Meilisearch) will need an explicit projection of metadata fields;
  it cannot rely on Medusa's structured fields.

## Recommendation (for the revisit)
Promote the fields that drive **filtering / search / merchandising** to
first-class, and keep the long tail in metadata:
1. **Brand → a small custom `brand` module + product↔brand link** (or, lighter,
   Medusa product **type**/**collection** if one-brand-per-product holds). Enables
   server-side facets, brand pages, logos.
2. **Vendor → a product↔vendor module link** instead of `metadata.vendor_id`.
3. **Filterable attributes → Meilisearch facets** (project the needed metadata
   keys into the search index) rather than DB filtering on jsonb. This is the
   pragmatic path: Medusa for the source of truth, Meilisearch for faceted PLP.
4. Keep purely-informational attributes (warranty, dimensions, install guide)
   in `metadata.attributes` — they don't need to be first-class.

The current approach is acceptable to ship and demo; do (1)–(3) before relying on
catalog filtering/search in production.

## Alternatives considered
- **Model all 136 attributes as columns/entities.** Over-engineered; most are
  rarely used and informational. Rejected.
- **Pure metadata + Meilisearch for everything (no first-class brand/vendor).**
  Works for search but loses relational integrity and merchandising. Partial.
