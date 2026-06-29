"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { useCart } from "@/lib/cart-context"

type CartItem = {
  id: string
  title: string
  brand: string
  quantity: number
  unit_price: number // cents
  thumbnail?: string
  variant_title?: string
}

type Props = {
  open: boolean
  onClose: () => void
  freeShippingThreshold?: number
}

const FREE_SHIPPING_THRESHOLD_CENTS = 9900 // 99 €
const toCents = (n: number | undefined | null) => Math.round((n ?? 0) * 100)

export function CartDrawer({
  open,
  onClose,
  freeShippingThreshold = FREE_SHIPPING_THRESHOLD_CENTS,
}: Props) {
  const { cart, total } = useCart()
  const drawerRef = useRef<HTMLDivElement>(null)
  const items: CartItem[] = (cart?.items ?? []).map((it: any) => ({
    id: it.id,
    title: it.product_title || it.title,
    brand: it.product?.metadata?.brand || "",
    quantity: it.quantity,
    unit_price: toCents(it.unit_price),
    thumbnail: it.thumbnail || undefined,
    variant_title: it.variant_title && it.variant_title !== "Standard" ? it.variant_title : undefined,
  }))
  const hasFreeShipping = total >= freeShippingThreshold
  const progressPct = Math.min((total / freeShippingThreshold) * 100, 100)

  // Trap focus & close on Escape
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", handleKey)
      document.body.style.overflow = ""
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      {/* Scrim */}
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-label="Ostukorv"
        aria-modal="true"
        className="fixed top-0 right-0 bottom-0 z-50 w-[412px] max-w-full bg-white shadow-[-8px_0_40px_rgba(0,0,0,.3)] flex flex-col"
      >
        {/* Header */}
        <div className="h-[60px] flex-shrink-0 bg-[#111] flex items-center justify-between px-[22px]">
          <div className="flex items-center gap-[9px]">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            <span className="text-[14px] font-bold text-white">Ostukorv</span>
            <span className="text-[13px] text-white/50">({items.length} toodet)</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Sulge ostukorv"
            className="w-7 h-7 flex items-center justify-center hover:opacity-70 transition-opacity"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="1.6">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Free shipping progress */}
        <div className="flex-shrink-0 px-[22px] py-[14px] bg-[#F6F6F4] border-b border-[#EAEAE7]">
          {hasFreeShipping ? (
            <p className="text-[12px] text-[#0D0D0D] mb-2">
              🎉 Sul on <strong>tasuta tarne!</strong> Tellimus ületab 99 €.
            </p>
          ) : (
            <p className="text-[12px] text-[#0D0D0D] mb-2">
              Lisage{" "}
              <strong>{((freeShippingThreshold - total) / 100).toFixed(0)} € </strong>
              veel tasuta tarne saamiseks.
            </p>
          )}
          <div className="h-[5px] bg-[#E2E2DE] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#2a7a2a] transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-[22px]">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <p className="text-[14px] text-[#999]">Ostukorv on tühi</p>
              <Link
                href="/"
                onClick={onClose}
                className="text-[13px] font-semibold text-[#E8001D] underline"
              >
                Jätka ostlemist →
              </Link>
            </div>
          ) : (
            items.map((item) => (
              <CartItem key={item.id} item={item} />
            ))
          )}
        </div>

        {/* Footer CTA */}
        {items.length > 0 && (
          <div className="flex-shrink-0 p-[22px] border-t border-[#F0F0F0]">
            <div className="flex justify-between items-baseline mb-[14px]">
              <span className="text-[13px] font-semibold text-[#0D0D0D]">Kokku</span>
              <span className="text-[18px] font-extrabold text-[#0D0D0D]">
                {(total / 100).toFixed(2)} €
              </span>
            </div>
            <Link
              href="/kassa"
              onClick={onClose}
              className="block w-full bg-[#E8001D] text-white text-[15px] font-bold text-center py-[14px] hover:bg-red-700 transition-colors"
            >
              Vormista tellimus →
            </Link>
            <button
              onClick={onClose}
              className="block w-full text-center text-[12px] text-[#999] mt-3 hover:text-[#0D0D0D] transition-colors"
            >
              Jätka ostlemist
            </button>
          </div>
        )}
      </div>
    </>
  )
}

function CartItem({ item }: { item: CartItem }) {
  const price = item.unit_price * item.quantity

  return (
    <div className="flex gap-[13px] py-4 border-b border-[#F0F0F0]">
      <div className="w-[74px] h-[74px] border border-[#EAEAEA] flex-shrink-0 relative bg-[#f8f8f8]">
        {item.thumbnail ? (
          <Image src={item.thumbnail} alt={item.title} fill className="object-contain p-1" />
        ) : (
          <div className="img-placeholder w-full h-full" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-[#999] tracking-[.05em] uppercase mb-[2px]">{item.brand}</p>
        <p className="text-[13px] font-semibold text-[#0D0D0D] leading-snug mb-[7px]">
          {item.title}
          {item.variant_title && (
            <span className="font-normal text-[#777]"> · {item.variant_title}</span>
          )}
        </p>
        <div className="flex items-center justify-between">
          <QuantityControl itemId={item.id} quantity={item.quantity} />
          <span className="text-[14px] font-bold text-[#0D0D0D]">
            {(price / 100).toFixed(2)} €
          </span>
        </div>
      </div>
    </div>
  )
}

function QuantityControl({ itemId, quantity }: { itemId: string; quantity: number }) {
  const { setQuantity, loading } = useCart()
  return (
    <div className="flex items-center border border-[#DDD]">
      <button
        onClick={() => setQuantity(itemId, quantity - 1)}
        disabled={loading}
        aria-label="Vähenda kogust"
        className="w-[26px] h-[26px] bg-white text-[14px] text-[#0D0D0D] flex items-center justify-center hover:bg-[#f5f5f5] disabled:opacity-50"
      >
        −
      </button>
      <span className="w-[30px] h-[26px] flex items-center justify-center text-[12px] font-bold border-x border-[#EEE]">
        {quantity}
      </span>
      <button
        onClick={() => setQuantity(itemId, quantity + 1)}
        disabled={loading}
        aria-label="Suurenda kogust"
        className="w-[26px] h-[26px] bg-white text-[14px] text-[#0D0D0D] flex items-center justify-center hover:bg-[#f5f5f5] disabled:opacity-50"
      >
        +
      </button>
    </div>
  )
}
