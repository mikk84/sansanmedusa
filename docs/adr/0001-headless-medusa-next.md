# ADR 0001 — Headless: Medusa v2 backend + Next.js 15 storefront

**Status:** Accepted · 2026-06

## Context
SanSan is replacing Magento 1.9.4.5. The client's hard constraints: modern,
fast, scalable, and explicitly **no WordPress / no PHP**. The business needs a
**strong order-management system** because most orders are drop-shipped from
20–30 vendors and the rest pass through SanSan's own terminal — with vendor
ordering happening only *after* the customer pays. The store is Estonian-market,
EUR, 22% VAT, Montonio payments.

## Decision
Use a **headless** architecture: **Medusa v2** (Node/TypeScript) as the commerce
engine + OMS + admin, and **Next.js 15** (App Router) as the storefront, talking
to Medusa's Store API. Postgres + Redis back Medusa; Meilisearch for search.

## Consequences
**Positive**
- Meets the no-PHP / modern / scalable constraints with a mainstream, well-trodden
  stack. Both apps are TypeScript end-to-end.
- Medusa ships an Admin panel, order lifecycle, regions/tax, and an **extensible
  module + workflow system** — we get the OMS scaffolding without building it.
- Storefront and backend scale and deploy independently.

**Negative / risks**
- Medusa v2 is relatively young; we hit real rough edges (admin bundling under
  pnpm, config loading, type strictness). Upgrades may churn.
- More moving parts than a monolith (separate API, storefront, search, payment).
- Team must know Medusa's conventions (modules, workflows, links) to extend safely.

## Alternatives considered
- **100% custom (no commerce framework).** Maximum control, but we'd rebuild
  cart, orders, admin, tax, payments — months of work and risk. Rejected.
- **Saleor / Vendure / commercetools.** Viable headless options. Medusa chosen
  for its TypeScript module system, self-hostable cost profile, and fit for the
  custom vendor/OMS logic. A defensible alternative if Medusa friction grows.
- **Stay on Magento / WooCommerce.** Violates the no-PHP constraint. Rejected.
