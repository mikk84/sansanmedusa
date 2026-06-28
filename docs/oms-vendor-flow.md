# Order Management & Vendor Flow

## Overview

SanSan operates a **hybrid fulfillment model**:

| Type | Who ships | To where | Configured on |
|---|---|---|---|
| `dropship` | Vendor | Customer's address | Vendor record |
| `via_terminal` | Vendor → SanSan → Customer | SanSan warehouse first | Vendor record |

The `fulfillment_type` is set **once per vendor** and applies automatically to every order containing that vendor's products. No per-order decisions needed.

---

## Current vendor mapping

Configure this in the Medusa Admin panel under **Vendors**. Initial values from the migration script (`scripts/migrate-products.ts`):

| Vendor | Type | Notes |
|---|---|---|
| SANITINO s.r.o. | dropship | |
| Ravak a.s. | dropship | |
| Duschy Marketing AS | dropship | |
| Casa Di Vanna | dropship | |
| Gemlook OÜ | dropship | |
| Vispool | dropship | |
| All others | via_terminal | Update as agreed with each vendor |

---

## Order lifecycle

### 1. Payment captured

```
Customer pays via Montonio
  → Medusa: order status = "pending"
  → order.placed event emitted
```

### 2. Vendor notification (automatic)

The `notify-vendors` workflow runs immediately after payment:

```
notifyVendorsWorkflow
  ├── groupItemsByVendor step
  │     Reads vendor_id from each line item's metadata
  │     Groups items: { "vendor_id_abc": [item1, item3], "vendor_id_xyz": [item2] }
  │
  └── sendVendorEmails step
        For each vendor group:
          if dropship → email subject "Palun saatke otse kliendile"
          if via_terminal → email subject "Palun saatke meie lattu"
        Sends via Resend API
```

**Example email — dropship (Estonian):**
```
Teema: SanSan tellimus #1042 – teie tooted

Tere,

Palun saatke järgmised tooted otse kliendile:

TARNE AADRESS:
Jaan Tamm
Pärnu mnt 12
10141 Tallinn
EE
Tel: +372 5001234

TOOTED:
  • SCH614 — Vihmadušš Schönberg Round 614 × 2

Tellimuse number: #1042
Kliendi e-post: jaan.tamm@gmail.com

Palun kinnitage tellimuse kättesaamine vastuskirjaga ja
teavitage meid saadetise jälgimisnumbrist.

Lugupidamisega,
SanSan OÜ
tellimused@sansan.ee
Tel: +372 6 406 405
```

**Example email — via_terminal (Estonian):**
```
Teema: SanSan tellimus #1042 – teie tooted

Tere,

Palun saatke järgmised tooted meie lattu:

TARNE AADRESS:
SanSan OÜ
[Warehouse address]
Tallinn
EE

TOOTED:
  • GEB-111.362.00.1 — Geberit Duofix WC-raam × 1

...
```

### 3. Invoice (automatic)

Simultaneously with vendor emails:
```
InvoiceModuleService.generateAndSend(order)
  → Builds Estonian VAT invoice HTML
  → Invoice number: SS-YYMM-0042
  → Emails to customer with HTML attachment
  → VAT rate: 22%
  → SanSan reg. no. + VAT no. printed on invoice
```

### 4. Admin order tracking

In the Medusa Admin panel (`/app/orders`):

```
Order #1042 — Jaan Tamm — 627 €        [status: Processing]
──────────────────────────────────────────────────────────
Fulfillments:

  LINTMAN EESTI AS  [via_terminal]
    ✉ Email sent 28.06 at 10:42
    □ Mark as: [Received at warehouse]

  SANITINO s.r.o.   [dropship]
    ✉ Email sent 28.06 at 10:42
    □ Mark as: [Shipped] + enter tracking number
```

### 5. Via-terminal two-step fulfillment

```
Step A: Vendor ships to warehouse
  Admin marks: "Received at warehouse"
  → No customer notification yet

Step B: SanSan ships to customer
  Admin marks: "Shipped" + enters tracking number
  → Customer gets: "Teie tellimus on teel!" email with tracking link
```

### 6. Order completion

```
When ALL items across ALL vendors are fulfilled:
  Order status → "Completed"
  No further action needed
```

---

## Adding a new vendor

1. Go to Medusa Admin → Vendors → Create vendor
2. Fill in: name, email, `fulfillment_type`
3. Set `terminal_address` if `via_terminal` (your warehouse address)
4. When adding products from this vendor, set their `metadata.vendor_id`

---

## Edge cases

**Order with items from 3 vendors:**
Three separate vendor emails sent. Each vendor fulfills independently. Order status shows partial fulfillment until all three complete.

**Vendor doesn't reply:**
Follow up manually. The admin order view shows the timestamp of when each vendor email was sent.

**Customer cancels before vendor ships:**
Process refund via Montonio merchant portal (currently manual). Mark order as "Cancelled" in Medusa Admin.

**Vendor sends wrong item:**
Create a return in Medusa Admin. Currently no automated return flow — handled case by case.
