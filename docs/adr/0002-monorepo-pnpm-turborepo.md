# ADR 0002 — pnpm + Turborepo monorepo

**Status:** Accepted · 2026-06

## Context
Two apps (`backend`, `storefront`) share types and ship together. We want one
repo, fast installs, and task caching.

## Decision
A **pnpm workspace** (`apps/*`, `packages/*`) orchestrated by **Turborepo**.

## Consequences
**Positive**
- Single clone, shared dev workflow, parallel/cached `dev`/`build`/`lint`.
- Shared TypeScript types possible across apps.

**Negative / risks**
- pnpm's strict, isolated `node_modules` fought the Medusa **admin bundler**
  (Vite), forcing `nodeLinker: hoisted` — see [ADR 0009](0009-pnpm-nodelinker-hoisted.md).
  This is a notable wrinkle and the main cost of the choice.
- Swapping `node_modules` (e.g. relinking) under a running `next dev` breaks
  webpack until `.next` is cleared — a recurring gotcha.

## Alternatives considered
- **npm/yarn workspaces.** Fewer isolation surprises with Medusa, but lose
  pnpm's speed/disk efficiency. Reasonable fallback if hoisting causes more pain.
- **Two separate repos.** Simpler tooling, but no shared types and double the
  ops. Rejected for a small team.
