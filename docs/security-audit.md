# Security Audit — SanSan

**Date:** 2026-07-01 · **Scope:** backend (config, custom API routes, payment
webhook, migration scripts, secrets, CORS, dependencies) + storefront client.
**Method:** source inspection + `pnpm audit` against the running codebase.

> Verdict: **no exploited-in-the-wild holes, but several real pre-production
> issues** — chiefly insecure secret fallbacks, an under-validated configured-cart
> endpoint, and a payment webhook that doesn't reconcile amounts. None block the
> demo; all should be closed before taking real money. Items here cross-reference
> the [remediation plan](remediation-plan.md).

Severity = likelihood × impact in a **production** context.

---

## HIGH

### S-H1 — JWT/cookie secrets fall back to a public literal
`apps/backend/medusa-config.js:13-14` — `jwtSecret`/`cookieSecret` default to
`"supersecret"` when env vars are unset. A misconfigured production boots
silently with a **known** signing secret → forgeable admin & customer sessions
(full account/admin takeover).
**Fix:** remove fallbacks; throw on missing secrets when `NODE_ENV=production`.
Generate ≥32-byte random values. **Effort: S.** (= review H5)

### S-H2 — Configured-cart endpoint under-validates (price/abuse)
`apps/backend/src/api/store/carts/[id]/configure/route.ts:67-103`. Good: price is
recomputed server-side (client can't set it). Gaps:
- **Required options not enforced** — a request omitting required choices still
  creates a line at bare base price.
- **Unknown `option_id`/`value_id` silently ignored** (not rejected) → underpriced
  line with misleading `configured_options` metadata.
- **`quantity` untrusted** — no positive-integer check; flows into the workflow
  (negative/huge values, DoS-via-quantity).
- **No max-surcharge bound**; percent deltas stack on the bare base.
- Reads raw `price_set` not `calculated_price` → diverges from future price lists.

**Fix:** validate the full selection server-side (all required present; every
id belongs to the product; quantity is a positive int; surcharge within a sane
bound); return **400** on any mismatch instead of skipping. **Effort: S.** (= H2)

### S-H3 — Montonio webhook authorizes without amount/replay checks
`apps/backend/src/modules/montonio/service.ts:117-141`,
`apps/backend/src/api/hooks/payment/montonio/route.ts:26-34`. The webhook
authorizes the payment session on a `payment_status` flag **without verifying the
decoded amount/currency/reference match the session**, has **inconsistent status
casing** (`"paid"` vs `"PAID"`), and has **no replay protection**. Trust boundary
between "paid" and "we order + ship" → risk of fulfilling underpaid/replayed
orders. (Not live today — module isn't registered, S-M1.)
**Fix:** verify signature **and** amount/currency/reference; single status path
(provider `getWebhookActionAndData`); store processed token id for replay
defense; implement real `refundPayment`. **Effort: M.** (= H4)

---

## MEDIUM

### S-M1 — Payment/invoice/search modules not registered
`medusa-config.js:20-42`. The Montonio provider, invoice generation, and search
indexing **don't run** (only `vendor` + `file` are loaded). Security-relevant
because the *documented* payment path isn't the *actual* one (checkout uses the
demo `pp_system_default`), which can mask the webhook gaps above during testing.
**Fix:** register modules; re-test the real payment path end-to-end. (= C1)

### S-M2 — CORS defaults to localhost
`medusa-config.js:8-10` — `storeCors`/`adminCors`/`authCors` default to localhost.
A production deploy that forgets these silently runs with dev origins (broken or,
if later "fixed" with `*`, over-permissive). **Fix:** require explicit CORS in
production; never use `*` for `authCors`. **Effort: S.**

### S-M3 — Cart access is bearer-by-id (Medusa default)
Any party holding a `cart_id` can read/modify that cart (incl. `/configure`).
This is standard Medusa behavior, but worth stating: cart ids must stay
client-private (they already live in `localStorage`, not URLs — good). No PII
beyond what the customer entered is exposed pre-auth. **Action:** keep cart ids
out of shareable URLs/logs; rely on the publishable-key middleware. **Informational.**

### S-M4 — No rate limiting on custom/auth endpoints
No app-level throttling on `/store/carts/:id/configure`, the Montonio webhook, or
auth. Abuse/enumeration/DoS surface. **Fix:** put the API behind a rate limiter
(reverse proxy / Medusa middleware) before launch. **Effort: S–M.**

### S-M5 — Dependency vulnerabilities (transitive)
`pnpm audit`: after bumping `vitest` to ≥3.2.6 (cleared 2 **critical** dev-server
RCE advisories I had introduced), **8 moderate + 2 high remain — all transitive
`vite` advisories** pulled in through `@medusajs/draft-order` → `@medusajs/
framework`. These are **build/dev-time** (not in the production runtime path) and
are upstream Medusa's to patch. **Action:** track `pnpm audit` in CI; bump when
Medusa releases updated framework deps; don't expose any Vite dev server publicly.
**Effort: S (monitor).**

---

## LOW / informational

- **S-L1 — Migration SQL uses one interpolated table name** (`import-magento.ts:148`,
  `FROM ${table}`). **Not exploitable** — `table` is one of four hardcoded
  constants and the source is a trusted local dump, not user input. All value
  binding uses `mysql2` parameters. Noted only as a pattern to avoid generalizing.
- **S-L2 — Throwaway MariaDB runs with `root/root`** on host `3307`. Local-only,
  ephemeral, holds a copy of the catalog (incl. **cost prices**). Action: keep it
  off any shared/public host; tear it down after import (`docker rm -f
  sansan-magento-import`).
- **S-L3 — `.env.example` is clean** — placeholders only (`change-me-…`), no real
  secrets; no `.env` files are git-tracked. **Good.**
- **S-L4 — Cost price correctly excluded** from product metadata/storefront
  (`SYSTEM_ATTRS` includes `cost`). The one must-not-leak field is handled. **Good.**
- **S-L5 — Vendor emails may be sent to `""`** (`import-magento.ts:262`) — not a
  vuln but an integrity bug; validate before send (= L6).
- **S-L6 — Admin password in `.env`** (`MEDUSA_ADMIN_PASSWORD`) is used by the
  migration script to log in. Fine for local; for prod, prefer a created admin +
  short-lived token over a stored password, and rotate the demo password
  (`SanSan2024!`).

---

## Good practices already in place
- Server-side price recomputation for configured products (anti-tamper instinct).
- Cost price excluded from all storefront-facing data.
- Secrets gitignored; `.env.example` uses obvious placeholders.
- Publishable key on the storefront; `/admin/*` routes inherit Medusa's admin auth;
  `/store/*` inherit the publishable-key middleware.
- Webhook verifies a JWT signature (just needs amount/replay checks on top).

## Recommended pre-launch security checklist
1. [ ] Remove secret/CORS fallbacks; enforce strong env-provided secrets (S-H1, S-M2).
2. [ ] Harden `/configure` validation (S-H2).
3. [ ] Montonio webhook amount + replay verification; one status path (S-H3).
4. [ ] Register + retest the real payment/invoice/search path (S-M1).
5. [ ] Add rate limiting at the proxy (S-M4).
6. [ ] `pnpm audit` in CI; rotate the demo admin password; tear down the import DB.
