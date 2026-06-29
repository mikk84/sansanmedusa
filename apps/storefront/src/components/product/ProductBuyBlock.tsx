"use client"

import { useState } from "react"
import type { SampleProduct } from "@/lib/sample-data"

export function ProductBuyBlock({ product }: { product: SampleProduct }) {
  const sizes = product.sizes ?? []
  const [size, setSize] = useState(sizes[0] ?? "")
  const [qty, setQty] = useState(1)

  const addToCart = () => {
    if (typeof window !== "undefined" && product.variant_id) {
      window.dispatchEvent(
        new CustomEvent("sansan:add-to-cart", {
          detail: { variant_id: product.variant_id, qty },
        })
      )
    }
  }

  return (
    <>
      {sizes.length > 0 && (
        <div className="mb-3">
          <p className="text-[11px] font-bold tracking-[.06em] uppercase text-[#0D0D0D] mb-2">Suurus</p>
          <div className="flex gap-2 flex-wrap">
            {sizes.map((s) => {
              const on = s === size
              return (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className={`px-[14px] py-[7px] text-[12px] font-${on ? "bold" : "normal"} cursor-pointer ${
                    on ? "border-2 border-[#E8001D] text-[#E8001D]" : "border border-[#DDD] text-[#888]"
                  }`}
                >
                  {s}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex gap-[10px] mt-auto">
        <div className="flex items-center border border-[#ccc] flex-shrink-0">
          <button
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="w-10 h-12 bg-white text-[18px] text-[#0D0D0D] hover:bg-[#F6F6F4]"
          >
            −
          </button>
          <span className="w-10 text-center text-[15px] font-bold text-[#0D0D0D] border-x border-[#DDD] h-12 flex items-center justify-center">
            {qty}
          </span>
          <button
            onClick={() => setQty((q) => q + 1)}
            className="w-10 h-12 bg-white text-[18px] text-[#0D0D0D] hover:bg-[#F6F6F4]"
          >
            +
          </button>
        </div>
        <button
          onClick={addToCart}
          className="flex-1 bg-[#E8001D] text-white text-[15px] font-bold tracking-[.02em] hover:bg-red-700 transition-colors h-12"
        >
          Lisa ostukorvi →
        </button>
        <button
          aria-label="Lisa soovinimekirja"
          className="w-12 h-12 bg-white border border-[#DDD] flex items-center justify-center flex-shrink-0 hover:border-[#E8001D] group"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.6" className="group-hover:stroke-[#E8001D]">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>
    </>
  )
}
