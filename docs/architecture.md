# System Architecture

## Component overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Customer browser                                               │
│  Next.js 15 App Router — SSG product pages, RSC, Tailwind CSS  │
│  Vercel (or VPS with Nginx)                                     │
└────────────────────┬────────────────────────────────────────────┘
                     │ REST API (HTTPS)
                     │ Public store routes: /store/*
                     │ Admin routes: /admin/* (staff only)
┌────────────────────▼────────────────────────────────────────────┐
│  Medusa v2 — apps/backend                                       │
│                                                                 │
│  Core modules (built-in):                                       │
│    Product catalog  · Categories · Inventory                    │
│    Cart · Checkout · Orders · Returns                           │
│    Customer accounts · Admin panel (React)                      │
│                                                                 │
│  Custom modules (src/modules/):                                 │
│    vendor/     — Vendor model, fulfillment_type flag            │
│    montonio/   — Montonio payment provider                      │
│    invoice/    — Estonian VAT invoice PDF + email               │
│    search/     — Meilisearch index management                   │
│                                                                 │
│  Workflows (src/workflows/):                                    │
│    notify-vendors — group order items by vendor, send emails    │
│                                                                 │
│  Subscribers (src/subscribers/):                                │
│    order-placed — triggers vendor notification workflow         │
└──────┬─────────────────────┬───────────────────────────────────┘
       │                     │
┌──────▼──────┐   ┌──────────▼──────────────────────────────────┐
│ PostgreSQL  │   │  External services                          │
│             │   │  Resend          — transactional email       │
│ Primary DB  │   │  Montonio        — payment gateway           │
│ All order,  │   │  Meilisearch     — product search index      │
│ product,    │   │  Cloudflare R2   — product image storage     │
│ vendor data │   └─────────────────────────────────────────────┘
└─────────────┘
       │
┌──────▼──────┐
│    Redis    │
│ Cart cache  │
│ Job queues  │
└─────────────┘
```

## Request flow — product page

```
User visits /tooted/duravit-dcode-ii-wc-pott
  → Next.js checks ISR cache
  → Cache miss: fetch product from Medusa /store/products?handle=...
  → Render HTML server-side
  → Return to browser (with 1hr revalidation)

User searches "grohe segisti"
  → Next.js API route /api/search?q=grohe+segisti
  → Meilisearch query (instant, typo-tolerant)
  → Return top 24 results as JSON
```

## Request flow — order placement

```
Customer clicks "Lisa ostukorvi"
  → POST /store/carts/:id/line-items (Medusa)

Customer proceeds to checkout
  → POST /store/payment-sessions (creates Montonio session)
  → Redirect to Montonio checkout URL

Customer pays
  → Montonio redirects back to /checkout/payment/callback
  → Montonio webhook: POST /hooks/payment/montonio (JWT verified)
  → Medusa: authorizePaymentSession → capturePayment
  → order.placed event fires

Subscriber: order-placed
  → notifyVendorsWorkflow runs
  → Groups line items by vendor
  → Sends email per vendor (dropship → customer address, terminal → warehouse)
  → InvoiceModuleService generates PDF + emails customer
```

## Environment-specific configuration

| Environment | Frontend | Backend | Database |
|---|---|---|---|
| Development | localhost:3000 | localhost:9000 | local PostgreSQL |
| Staging | staging.sansan.ee | api-staging.sansan.ee | Hetzner VPS |
| Production | sansan.ee | api.sansan.ee | Hetzner VPS (dedicated) |

## Scaling considerations

At current scale (4k products, Estonian market), a single Hetzner CX22 (2 vCPU, 4GB RAM, €4/mo) handles the backend comfortably. If traffic grows significantly:

1. Add read replicas for PostgreSQL
2. Add Medusa worker processes for background jobs
3. Move Meilisearch to a dedicated instance
4. Add CDN in front of Next.js (Cloudflare)
