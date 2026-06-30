# Architecture Decision Records (ADRs)

Each ADR captures one significant decision: the context, what was decided, why,
and the consequences (including the downsides). They exist so the reasoning can
be **challenged and revisited** — not to defend the choices.

Format: Context → Decision → Status → Consequences → Alternatives considered.
Status is one of: **Accepted**, **Accepted (revisit)**, **Superseded**, **Proposed**.

| # | Decision | Status |
|---|---|---|
| [0001](0001-headless-medusa-next.md) | Headless: Medusa v2 backend + Next.js 15 storefront | Accepted |
| [0002](0002-monorepo-pnpm-turborepo.md) | pnpm + Turborepo monorepo | Accepted |
| [0003](0003-vendor-module-hybrid-oms.md) | Custom vendor module for hybrid dropship / via-terminal OMS | Accepted |
| [0004](0004-product-data-model-metadata.md) | Product attributes/brand/options in product `metadata` | **Accepted (revisit)** |
| [0005](0005-configurable-products-custom-options.md) | Configurable products via Magento custom options + configurator | Accepted (revisit) |
| [0006](0006-payments-montonio.md) | Payments via Montonio (system provider for dev) | Accepted |
| [0007](0007-migration-sql-dump-importer.md) | Migration via SQL dump → MariaDB → `medusa exec` importer | Accepted |
| [0008](0008-images-local-static-then-r2.md) | Images: local `/static` now, Cloudflare R2 for production | Accepted |
| [0009](0009-pnpm-nodelinker-hoisted.md) | `nodeLinker: hoisted` for the Medusa admin bundler | Accepted |

> The ADRs marked **revisit** are the load-bearing decisions worth re-examining
> first — see [architecture-review.md](../architecture-review.md) and
> [independent-review.md](../independent-review.md).
