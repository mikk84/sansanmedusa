# ADR 0009 — `nodeLinker: hoisted` for the Medusa admin bundler

**Status:** Accepted · 2026-06

## Context
Medusa's Admin is a Vite-bundled React SPA built/served from `apps/backend`.
pnpm's default **isolated** `node_modules` hides Medusa's internal admin packages
(`@medusajs/admin-shared`, `@medusajs/dashboard`, `@medusajs/draft-order/admin`)
from Vite/Rollup, breaking both `medusa develop` and `medusa build` with
"Failed to resolve import" and blank renders.

## Decision
Set **`nodeLinker: hoisted`** in `pnpm-workspace.yaml` (flat, npm-style
`node_modules`), add `@medusajs/admin-sdk` as a backend dep, and set
`moduleResolution: "Bundler"` in the backend `tsconfig` so TypeScript resolves
Medusa's `exports` subpaths. `medusa-config` is plain CommonJS (`.js`).

## Consequences
**Positive**
- The admin renders and `medusa build` passes — the supported layout for Medusa
  + pnpm.

**Negative / risks**
- Loses pnpm's strict isolation (phantom-dependency protection) for the whole
  workspace.
- Reinstalling deps swaps `node_modules` under a running `next dev`, breaking
  webpack until `.next` is cleared — a documented operational gotcha.

## Alternatives considered
- **`public-hoist-pattern` for `@medusajs/*` only.** Didn't apply reliably in
  pnpm v11 here. Rejected.
- **npm/yarn for the whole repo.** Avoids the issue but loses pnpm benefits
  ([ADR 0002](0002-monorepo-pnpm-turborepo.md)). Fallback option.
