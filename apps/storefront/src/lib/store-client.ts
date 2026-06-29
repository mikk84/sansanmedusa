/**
 * store-client.ts — browser-side Medusa Store API client for cart + checkout.
 *
 * Distinct from lib/medusa.ts (server-side catalog reads). These run in the
 * client (cart mutations) and use the publishable key. The active region id is
 * resolved once and cached; the cart id is persisted by the cart context.
 */

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-publishable-api-key": PUBLISHABLE_KEY,
      ...(init?.headers || {}),
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Store API ${path} → ${res.status}: ${body.slice(0, 300)}`)
  }
  return res.json() as Promise<T>
}

// The fields we want back on the cart everywhere.
const CART_FIELDS =
  "fields=*items,*items.variant,*items.product,*shipping_methods,*shipping_address,*billing_address,*payment_collection,*payment_collection.payment_sessions,+region.*,*items.thumbnail"

let cachedRegionId: string | null = null
export async function getRegionId(): Promise<string> {
  if (cachedRegionId) return cachedRegionId
  const { regions } = await api<{ regions: { id: string; currency_code: string }[] }>(
    "/store/regions"
  )
  const eur = regions.find((r) => r.currency_code === "eur") || regions[0]
  cachedRegionId = eur?.id ?? ""
  return cachedRegionId
}

export type StoreCart = any

export async function retrieveCart(cartId: string): Promise<StoreCart | null> {
  try {
    const { cart } = await api<{ cart: StoreCart }>(`/store/carts/${cartId}?${CART_FIELDS}`)
    return cart
  } catch {
    return null // stale/expired/completed cart id
  }
}

export async function createCart(): Promise<StoreCart> {
  const region_id = await getRegionId()
  const { cart } = await api<{ cart: StoreCart }>("/store/carts", {
    method: "POST",
    body: JSON.stringify({ region_id }),
  })
  return cart
}

export async function addLineItem(
  cartId: string,
  variantId: string,
  quantity = 1
): Promise<StoreCart> {
  const { cart } = await api<{ cart: StoreCart }>(
    `/store/carts/${cartId}/line-items?${CART_FIELDS}`,
    { method: "POST", body: JSON.stringify({ variant_id: variantId, quantity }) }
  )
  return cart
}

export async function updateLineItem(
  cartId: string,
  itemId: string,
  quantity: number
): Promise<StoreCart> {
  const { cart } = await api<{ cart: StoreCart }>(
    `/store/carts/${cartId}/line-items/${itemId}?${CART_FIELDS}`,
    { method: "POST", body: JSON.stringify({ quantity }) }
  )
  return cart
}

export async function deleteLineItem(cartId: string, itemId: string): Promise<StoreCart | null> {
  await api(`/store/carts/${cartId}/line-items/${itemId}`, { method: "DELETE" })
  return retrieveCart(cartId)
}

// ── Checkout ──────────────────────────────────────────────────────────────
export async function updateCart(cartId: string, data: any): Promise<StoreCart> {
  const { cart } = await api<{ cart: StoreCart }>(`/store/carts/${cartId}?${CART_FIELDS}`, {
    method: "POST",
    body: JSON.stringify(data),
  })
  return cart
}

export async function listShippingOptions(cartId: string): Promise<any[]> {
  const { shipping_options } = await api<{ shipping_options: any[] }>(
    `/store/shipping-options?cart_id=${cartId}`
  )
  return shipping_options
}

export async function addShippingMethod(
  cartId: string,
  optionId: string
): Promise<StoreCart> {
  const { cart } = await api<{ cart: StoreCart }>(
    `/store/carts/${cartId}/shipping-methods?${CART_FIELDS}`,
    { method: "POST", body: JSON.stringify({ option_id: optionId }) }
  )
  return cart
}

export async function initPaymentCollection(cartId: string): Promise<any> {
  const { payment_collection } = await api<{ payment_collection: any }>(
    "/store/payment-collections",
    { method: "POST", body: JSON.stringify({ cart_id: cartId }) }
  )
  return payment_collection
}

export async function initPaymentSession(
  paymentCollectionId: string,
  providerId: string
): Promise<any> {
  const { payment_collection } = await api<{ payment_collection: any }>(
    `/store/payment-collections/${paymentCollectionId}/payment-sessions`,
    { method: "POST", body: JSON.stringify({ provider_id: providerId }) }
  )
  return payment_collection
}

export async function completeCart(
  cartId: string
): Promise<{ type: "order" | "cart"; order?: any; error?: string }> {
  const res = await fetch(`${BACKEND_URL}/store/carts/${cartId}/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-publishable-api-key": PUBLISHABLE_KEY,
    },
  })
  const data = await res.json()
  if (data.type === "order") return { type: "order", order: data.order }
  return { type: "cart", error: data.error || data.message || "Tellimuse vormistamine ebaõnnestus" }
}
