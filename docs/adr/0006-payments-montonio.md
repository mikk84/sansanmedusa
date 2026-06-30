# ADR 0006 — Payments via Montonio (system provider for dev)

**Status:** Accepted · 2026-06

## Context
Estonian market: customers expect **bank links** (Swedbank, SEB, LHV…), cards,
and **hire-purchase (järelmaks)**. Montonio aggregates all of these in one
Estonian provider. Payment must be confirmed before SanSan orders from vendors.

## Decision
A custom Medusa payment provider module **`montonio`** (extends
`AbstractPaymentProvider`, JWT-signed order token + webhook verification). For
local dev/demo, the built-in **`pp_system_default`** provider is linked to the
region so checkout completes without live credentials.

## Consequences
**Positive**
- Single integration covers bank links + card + järelmaks for the Baltics.
- Webhook JWT verification stub is in place; checkout flow is provider-agnostic.

**Negative / risks**
- The Montonio provider is **scaffolded, not yet wired live** (needs merchant
  keys + region link + redirect/return handling tested).
- `getWebhookActionAndData` / refund paths are placeholders typed as `any`
  (relaxed to pass `medusa build`); tighten when integrating for real.
- Order-after-payment guarantee depends on the webhook → `order.placed` →
  notify-vendors chain working reliably; needs an end-to-end test with Montonio.

## Alternatives considered
- **Stripe.** No native Estonian bank links / järelmaks. Rejected for this market.
- **Direct bank-by-bank integrations.** Far more work than Montonio. Rejected.
