import Link from "next/link"
import { notFound } from "next/navigation"
import { Header } from "@/components/layout/Header"
import { ProductBuyBlock } from "@/components/product/ProductBuyBlock"
import { ProductGallery } from "@/components/product/ProductGallery"
import { getProductByHandle } from "@/lib/medusa"

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const product = await getProductByHandle(slug)
  if (!product) notFound()

  const category = product.category ? { slug: product.category, label: product.category } : null
  const hasDiscount = product.special_price && product.special_price < product.price
  const savings = hasDiscount ? product.price - product.special_price! : 0
  const fullStars = Math.floor(product.rating ?? 0)
  const gallery = (product.images && product.images.length ? product.images : [product.image_url]).filter(Boolean) as string[]

  return (
    <>
      <Header />

      {/* breadcrumb */}
      <div className="h-[38px] flex items-center px-[--page-px] border-b border-[#EEE] gap-[7px]"
        style={{ paddingLeft: "var(--page-px)", paddingRight: "var(--page-px)" }}>
        <Link href="/" className="text-[12px] text-[#999] hover:text-[#0D0D0D]">Avaleht</Link>
        <span className="text-[12px] text-[#ccc]">›</span>
        {category && (
          <>
            <Link href={`/kategooriad/${category.slug}`} className="text-[12px] text-[#999] hover:text-[#0D0D0D]">
              {category.label}
            </Link>
            <span className="text-[12px] text-[#ccc]">›</span>
          </>
        )}
        <span className="text-[12px] font-semibold text-[#0D0D0D] truncate">{product.name}</span>
      </div>

      {/* MAIN: gallery 52% / info 48% */}
      <div className="flex flex-col lg:flex-row">
        {/* GALLERY */}
        <div className="lg:w-[52%] lg:border-r border-[#EEE] p-[26px]">
          <ProductGallery
            images={gallery}
            alt={product.name}
            discountBadge={hasDiscount ? `ERIHIND −${Math.round((savings / product.price) * 100)}%` : null}
          />
        </div>

        {/* INFO */}
        <div className="flex-1 p-[26px_30px] flex flex-col">
          <div className="flex items-baseline justify-between mb-[6px]">
            <span className="text-[11px] font-bold tracking-[.12em] uppercase text-[#888]">{product.brand}</span>
            <span className="text-[11px] text-[#bbb]">Art. {product.sku}</span>
          </div>
          <h1 className="text-[24px] font-extrabold leading-[1.18] text-[#0D0D0D] tracking-[-.02em] mb-[9px]">
            {product.name}
          </h1>

          {/* rating */}
          {product.rating && (
            <div className="flex items-center gap-2 mb-[14px]">
              <span className="text-[#E8001D] text-[13px] tracking-[1px]">{"★".repeat(fullStars)}</span>
              <span className="text-[#DDD] text-[13px]">{"★".repeat(5 - fullStars)}</span>
              <span className="text-[12px] text-[#888]">{product.rating} · {product.review_count} arvustust</span>
              <a className="text-[12px] text-[#E8001D] underline cursor-pointer">Loe arvustusi</a>
            </div>
          )}

          {/* price */}
          <div className="flex items-end gap-3 mb-1">
            <span className="text-[32px] font-extrabold text-[#E8001D] tracking-[-.02em] leading-none">
              {((hasDiscount ? product.special_price! : product.price) / 100).toFixed(2).replace(".", ",")} €
            </span>
            {hasDiscount && (
              <span className="text-[13px] text-[#bbb] line-through mb-[3px]">
                {(product.price / 100).toFixed(2).replace(".", ",")} €
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#999] mb-[13px]">
            Sisaldab 24% KM{hasDiscount ? ` · Säästad ${(savings / 100).toFixed(0)} €` : ""}
          </p>

          {/* availability */}
          <div className="flex items-center gap-[14px] mb-4 p-[11px_14px] bg-[#F7F8F6] border border-[#ECEEE9]">
            <span className={`inline-flex items-center gap-[6px] text-[12px] font-bold ${product.in_stock ? "text-[#2a7a2a]" : "text-[#888]"}`}>
              <span className={`w-2 h-2 rounded-full ${product.in_stock ? "bg-[#2a7a2a]" : "bg-[#bbb]"}`} />
              {product.in_stock ? "Laos" : "Tellimusel"}
            </span>
            <span className="w-px h-[13px] bg-[#D8DAD4]" />
            <span className="inline-flex items-center gap-[6px] text-[12px] font-semibold text-[#0D0D0D]">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0D0D0D" strokeWidth="1.6">
                <rect x="1" y="4" width="14" height="12" /><path d="M15 9h4l3 3v4h-7V9z" />
                <circle cx="5.5" cy="18" r="2" /><circle cx="18" cy="18" r="2" />
              </svg>
              {product.delivery}
            </span>
          </div>

          {/* short description */}
          <p className="text-[13px] leading-[1.6] text-[#555] mb-4">{product.short_description}</p>

          {/* key attributes */}
          {product.attributes.length > 0 && (
            <div className="border border-[#ECECEC] mb-[18px]">
              <div className="grid grid-cols-2">
                {product.attributes.map((attr, i) => (
                  <div
                    key={`${attr.label}-${i}`}
                    className={`flex justify-between gap-2 p-[9px_13px] border-b border-[#F0F0F0] ${i % 2 === 0 ? "border-r" : ""}`}
                  >
                    <span className="text-[11px] text-[#999]">{attr.label}</span>
                    {attr.url ? (
                      <a
                        href={attr.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-semibold text-[#E8001D] text-right underline"
                      >
                        {attr.value} →
                      </a>
                    ) : (
                      <span className="text-[11px] font-semibold text-[#0D0D0D] text-right">{attr.value}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* size + qty + CTA (interactive) */}
          <ProductBuyBlock product={product} />
        </div>
      </div>

      {/* LONG DESCRIPTION */}
      {product.description && (
        <section className="border-t border-[#EEE] px-[--page-px] py-10"
          style={{ paddingLeft: "var(--page-px)", paddingRight: "var(--page-px)" }}>
          <h2 className="text-[12px] font-bold tracking-[.12em] uppercase text-[#0D0D0D] mb-4">
            Toote kirjeldus
          </h2>
          <div className="max-w-[760px] text-[14px] leading-[1.7] text-[#444] whitespace-pre-line">
            {product.description}
          </div>
        </section>
      )}
    </>
  )
}
