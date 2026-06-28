import Image from "next/image"
import Link from "next/link"

type Props = {
  product: {
    id: string
    slug: string
    name: string
    brand: string
    price: number
    special_price?: number | null
    image_url?: string | null
    is_new?: boolean
  }
}

export function ProductCard({ product }: Props) {
  const hasDiscount = product.special_price && product.special_price < product.price
  const discountPct = hasDiscount
    ? Math.round(((product.price - product.special_price!) / product.price) * 100)
    : 0
  const displayPrice = hasDiscount ? product.special_price! : product.price

  return (
    <Link
      href={`/tooted/${product.slug}`}
      className="group border border-[#EAEAEA] flex flex-col hover:shadow-md transition-shadow"
    >
      {/* Image */}
      <div className="relative aspect-square bg-[#f8f8f8]">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            className="object-contain p-3 group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="img-placeholder w-full h-full" />
        )}

        {hasDiscount && (
          <span className="absolute top-2 left-2 bg-[#E8001D] text-white text-[9px] font-bold px-[6px] py-[3px]">
            −{discountPct}%
          </span>
        )}
        {product.is_new && !hasDiscount && (
          <span className="absolute top-2 left-2 bg-[#111] text-white text-[9px] font-bold px-[6px] py-[3px]">
            UUS
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-[10px_11px] border-t border-[#EAEAEA] flex flex-col flex-1">
        <p className="text-[9px] text-[#999] tracking-[.06em] uppercase mb-[3px]">
          {product.brand}
        </p>
        <p className="text-[12px] font-semibold text-[#0D0D0D] leading-snug mb-2 flex-1">
          {product.name}
        </p>
        <div className="flex items-baseline gap-[7px]">
          <span className={`text-[15px] font-bold ${hasDiscount ? "text-[#E8001D]" : "text-[#0D0D0D]"}`}>
            {(displayPrice / 100).toFixed(0)} €
          </span>
          {hasDiscount && (
            <span className="text-[11px] text-[#bbb] line-through">
              {(product.price / 100).toFixed(0)} €
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
