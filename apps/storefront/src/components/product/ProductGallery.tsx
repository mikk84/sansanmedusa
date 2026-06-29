"use client"

import { useState } from "react"
import Image from "next/image"

export function ProductGallery({
  images,
  alt,
  discountBadge,
}: {
  images: string[]
  alt: string
  discountBadge?: string | null
}) {
  const [active, setActive] = useState(0)
  const current = images[active]

  return (
    <div className="flex flex-col gap-[14px]">
      {/* main image */}
      <div className="flex-1 min-h-[360px] border border-[#EEE] relative flex items-center justify-center bg-white">
        {current ? (
          <Image
            src={current}
            alt={alt}
            fill
            className="object-contain p-6"
            sizes="(max-width: 1024px) 100vw, 52vw"
            priority
          />
        ) : (
          <div className="img-placeholder absolute inset-0" />
        )}
        {discountBadge && (
          <span className="absolute top-[14px] left-[14px] bg-[#E8001D] text-white text-[11px] font-bold px-[10px] py-[5px] z-10">
            {discountBadge}
          </span>
        )}
      </div>

      {/* thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-[11px] flex-wrap">
          {images.map((src, i) => (
            <button
              key={src + i}
              onClick={() => setActive(i)}
              aria-label={`Pilt ${i + 1}`}
              className={`relative w-20 h-20 border bg-white transition-colors ${
                i === active ? "border-2 border-[#E8001D]" : "border-[#DDD] hover:border-[#999]"
              }`}
            >
              <Image src={src} alt="" fill className="object-contain p-1" sizes="80px" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
