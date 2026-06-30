# ADR 0007 — Migration via SQL dump → MariaDB → `medusa exec` importer

**Status:** Accepted · 2026-06

## Context
The Magento catalog (4,095 enabled products, EAV attributes, categories, custom
options, images-by-path) had to move into Medusa. An early flat-CSV approach
lost the EAV structure (attribute sets, option labels, the category tree).

## Decision
Take a **full Magento MariaDB dump**, load it into a throwaway MariaDB container,
and run a **`medusa exec` importer** (`import-magento.ts`) that reads the EAV
tables via `mysql2` and creates products/categories/vendors through Medusa's
**native workflows** (correct price sets, sales-channel links, category tree).
Images are matched separately (`attach-images.ts`); checkout prerequisites via
`checkout-setup.ts`.

## Consequences
**Positive**
- Preserves full EAV fidelity (attribute sets, resolved option labels, hierarchy).
- Uses Medusa workflows, so pricing/inventory/links are created correctly.
- Re-runnable: skips existing SKUs; ~13s for the full product run.

**Negative / risks**
- **Category re-import is not idempotent** (a re-run would create suffixed
  duplicate handles) — documented requirement to clear products+categories first.
- Importer is a sizeable script with bespoke EAV decoding (HTML entities,
  multiselect option ids, visibility flags) — **needs tests** to prevent
  regressions (e.g. the Estonian-character bug that was found and fixed).
- The throwaway MariaDB is ephemeral; reloadable from `scripts/data/*.sql.gz`.

## Alternatives considered
- **Flat CSV export → importer.** Simpler but lossy (flattens attribute sets /
  option labels). Used first, then replaced. Rejected.
- **Medusa's product import (CSV) feature.** Doesn't model the custom EAV /
  vendor / custom-options needs. Rejected.
