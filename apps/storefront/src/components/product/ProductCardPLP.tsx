"use client"

import Link from "next/link"
import Image from "next/image"
import type { SampleProduct } from "@/lib/sample-data"

type Props = {
  product: SampleProduct
  onAddToCart?: (product: SampleProduct) => void
}

/**
 * Catalog (PLP) product card — matches design Frame 9.
 * Differs from the homepage ProductCard by including an inline "Korvi" button
 * and supporting the TELLIMUSEL (order-only) badge.
 */
export function ProductCardPLP({ product, onAddToCart }: Props) {
  const hasDiscount = product.special_price && product.special_price < product.price
  const displayPrice = hasDiscount ? product.special_price! : product.price

  return (
    <div className="border border-[#EAEAEA] flex flex-col group hover:shadow-md transition-shadow">
      <Link href={`/tooted/${product.slug}`} className="relative aspect-[4/3] block bg-white">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            className="object-contain p-2 group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 50vw, 33vw"
          />
        ) : (
          <div className="img-placeholder w-full h-full" />
        )}
        {product.badge === "new" && (
          <span className="absolute top-[9px] left-[9px] bg-[#E8001D] text-white text-[9px] font-bold px-[6px] py-[3px]">
            UUS
          </span>
        )}
        {product.badge === "sale" && hasDiscount && (
          <span className="absolute top-[9px] left-[9px] bg-[#E8001D] text-white text-[9px] font-bold px-[6px] py-[3px]">
            −{Math.round(((product.price - product.special_price!) / product.price) * 100)}%
          </span>
        )}
        {product.badge === "order" && (
          <span className="absolute top-[9px] right-[9px] bg-[#555] text-white text-[9px] font-bold px-[6px] py-[3px]">
            TELLIMUSEL
          </span>
        )}
      </Link>

      <div className="p-[11px_12px] border-t border-[#EAEAEA] flex flex-col gap-1 flex-1">
        <p className="text-[9px] text-[#999] tracking-[.06em] uppercase">{product.brand}</p>
        <Link
          href={`/tooted/${product.slug}`}
          className="text-[13px] font-semibold text-[#0D0D0D] leading-snug hover:text-[#E8001D] transition-colors"
        >
          {product.name}
        </Link>

        <div className="mt-auto flex items-center justify-between pt-2">
          {hasDiscount ? (
            <div className="leading-none">
              <span className="text-[11px] text-[#bbb] line-through block">
                {(product.price / 100).toFixed(0)} €
              </span>
              <span className="text-[16px] font-bold text-[#E8001D]">
                {(displayPrice / 100).toFixed(0)} €
              </span>
            </div>
          ) : (
            <span className="text-[16px] font-bold text-[#0D0D0D]">
              {(displayPrice / 100).toFixed(0)} €
            </span>
          )}
          <button
            onClick={() => onAddToCart?.(product)}
            className="bg-[#E8001D] text-white text-[11px] font-bold px-[11px] py-[7px] hover:bg-red-700 transition-colors"
          >
            Korvi
          </button>
        </div>
      </div>
    </div>
  )
}
