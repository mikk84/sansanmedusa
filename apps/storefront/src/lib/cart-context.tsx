"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react"
import {
  retrieveCart,
  createCart,
  addLineItem,
  updateLineItem,
  deleteLineItem,
  type StoreCart,
} from "./store-client"

const CART_ID_KEY = "sansan_cart_id"

type CartContextValue = {
  cart: StoreCart | null
  count: number
  total: number // cents
  loading: boolean
  drawerOpen: boolean
  openDrawer: () => void
  closeDrawer: () => void
  addVariant: (variantId: string, quantity?: number) => Promise<void>
  setQuantity: (itemId: string, quantity: number) => Promise<void>
  removeItem: (itemId: string) => Promise<void>
  refresh: () => Promise<void>
  clearCart: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

// Medusa Store API returns prices in major units; the UI works in cents.
const toCents = (n: number | undefined | null) => Math.round((n ?? 0) * 100)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<StoreCart | null>(null)
  const [loading, setLoading] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const cartIdRef = useRef<string | null>(null)

  // Ensure a cart exists; returns its id.
  const ensureCart = useCallback(async (): Promise<string> => {
    if (cartIdRef.current) return cartIdRef.current
    const stored = typeof window !== "undefined" ? localStorage.getItem(CART_ID_KEY) : null
    if (stored) {
      const existing = await retrieveCart(stored)
      if (existing) {
        cartIdRef.current = existing.id
        setCart(existing)
        return existing.id
      }
    }
    const fresh = await createCart()
    cartIdRef.current = fresh.id
    localStorage.setItem(CART_ID_KEY, fresh.id)
    setCart(fresh)
    return fresh.id
  }, [])

  // Hydrate an existing cart on mount (don't create one until needed).
  useEffect(() => {
    const stored = localStorage.getItem(CART_ID_KEY)
    if (!stored) return
    retrieveCart(stored).then((c) => {
      if (c) {
        cartIdRef.current = c.id
        setCart(c)
      } else {
        localStorage.removeItem(CART_ID_KEY)
      }
    })
  }, [])

  const addVariant = useCallback(
    async (variantId: string, quantity = 1) => {
      setLoading(true)
      try {
        const id = await ensureCart()
        const updated = await addLineItem(id, variantId, quantity)
        setCart(updated)
        setDrawerOpen(true)
      } finally {
        setLoading(false)
      }
    },
    [ensureCart]
  )

  const setQuantity = useCallback(async (itemId: string, quantity: number) => {
    const id = cartIdRef.current
    if (!id) return
    setLoading(true)
    try {
      const updated =
        quantity <= 0
          ? await deleteLineItem(id, itemId)
          : await updateLineItem(id, itemId, quantity)
      setCart(updated)
    } finally {
      setLoading(false)
    }
  }, [])

  const removeItem = useCallback(async (itemId: string) => {
    const id = cartIdRef.current
    if (!id) return
    setLoading(true)
    try {
      setCart(await deleteLineItem(id, itemId))
    } finally {
      setLoading(false)
    }
  }, [])

  const refresh = useCallback(async () => {
    const id = cartIdRef.current
    if (!id) return
    const c = await retrieveCart(id)
    setCart(c)
  }, [])

  const clearCart = useCallback(() => {
    localStorage.removeItem(CART_ID_KEY)
    cartIdRef.current = null
    setCart(null)
  }, [])

  // Listen for "add to cart" events dispatched by product cards / PDP.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      const variantId =
        detail?.product?.variants?.[0]?.id ||
        detail?.variant_id ||
        detail?.variantId
      const qty = detail?.qty ?? detail?.quantity ?? 1
      if (variantId) addVariant(variantId, qty)
    }
    window.addEventListener("sansan:add-to-cart", handler)
    return () => window.removeEventListener("sansan:add-to-cart", handler)
  }, [addVariant])

  const items = cart?.items ?? []
  const count = items.reduce((n: number, it: any) => n + (it.quantity ?? 0), 0)
  const total = toCents(cart?.item_total ?? cart?.subtotal ?? 0)

  return (
    <CartContext.Provider
      value={{
        cart,
        count,
        total,
        loading,
        drawerOpen,
        openDrawer: () => setDrawerOpen(true),
        closeDrawer: () => setDrawerOpen(false),
        addVariant,
        setQuantity,
        removeItem,
        refresh,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error("useCart must be used within <CartProvider>")
  return ctx
}
