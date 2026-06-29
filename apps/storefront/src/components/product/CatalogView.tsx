"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { ProductCardPLP } from "./ProductCardPLP"
import type { SampleCategory, SampleProduct, SampleBrand } from "@/lib/sample-data"

type Props = {
  category: SampleCategory
  products: SampleProduct[]
  subcategories: { label: string; count: number }[]
  brands: SampleBrand[]
  page?: number
  totalPages?: number
}

type SortKey = "popular" | "price-asc" | "price-desc" | "new"

const SORT_LABELS: Record<SortKey, string> = {
  popular: "Populaarsed",
  "price-asc": "Hind: odavamad ees",
  "price-desc": "Hind: kallimad ees",
  new: "Uued tooted",
}

export function CatalogView({ category, products, subcategories, brands, page = 1, totalPages = 1 }: Props) {
  const [activeSubs, setActiveSubs] = useState<string[]>(
    subcategories.length ? [subcategories[0].label] : []
  )
  const [activeBrands, setActiveBrands] = useState<string[]>([])
  const [sort, setSort] = useState<SortKey>("popular")
  const [sortOpen, setSortOpen] = useState(false)

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])

  const sorted = useMemo(() => {
    const arr = [...products]
    if (activeBrands.length) {
      // brand filter applied client-side over sample set
      const filtered = arr.filter((p) => activeBrands.includes(p.brand))
      if (filtered.length) arr.splice(0, arr.length, ...filtered)
    }
    switch (sort) {
      case "price-asc":
        return arr.sort((a, b) => (a.special_price ?? a.price) - (b.special_price ?? b.price))
      case "price-desc":
        return arr.sort((a, b) => (b.special_price ?? b.price) - (a.special_price ?? a.price))
      case "new":
        return arr.sort((a, b) => Number(b.badge === "new") - Number(a.badge === "new"))
      default:
        return arr
    }
  }, [products, sort, activeBrands])

  const addToCart = (p: SampleProduct) => {
    if (typeof window !== "undefined" && p.variant_id) {
      window.dispatchEvent(
        new CustomEvent("sansan:add-to-cart", { detail: { variant_id: p.variant_id, qty: 1 } })
      )
    }
  }

  return (
    <div className="flex min-h-[600px]">
      {/* ── SIDEBAR FILTERS ─────────────────────────────────────────── */}
      <aside className="w-[236px] flex-shrink-0 bg-[#F7F7F5] border-r border-[#E8E8E5] p-[18px] hidden lg:block">
        <p className="text-[10px] font-bold tracking-[.12em] uppercase text-[#0D0D0D] mb-4">
          Filtrid
        </p>

        {subcategories.length > 0 && (
          <div className="mb-4 pb-4 border-b border-[#E2E2DE]">
            <p className="text-[11px] font-bold text-[#0D0D0D] mb-[10px]">Alamkategooria</p>
            <div className="flex flex-col gap-[9px]">
              {subcategories.map((s) => {
                const on = activeSubs.includes(s.label)
                return (
                  <label key={s.label} className="flex items-center gap-2 cursor-pointer">
                    <span
                      onClick={() => toggle(activeSubs, setActiveSubs, s.label)}
                      className={`w-[15px] h-[15px] flex items-center justify-center flex-shrink-0 border ${
                        on ? "bg-[#0D0D0D] border-[#0D0D0D]" : "bg-white border-[#ccc]"
                      }`}
                    >
                      {on && (
                        <svg width="9" height="9" viewBox="0 0 8 8" fill="none">
                          <polyline points="1,4 3,6.5 7,1.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      )}
                    </span>
                    <span className={`text-[12px] ${on ? "font-semibold text-[#0D0D0D]" : "text-[#555]"}`}>
                      {s.label} <span className="text-[#aaa] font-normal">({s.count})</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        )}

        {/* Price */}
        <div className="mb-4 pb-4 border-b border-[#E2E2DE]">
          <p className="text-[11px] font-bold text-[#0D0D0D] mb-[10px]">Hind</p>
          <div className="flex items-center gap-[6px] mb-[11px]">
            <div className="flex-1 border border-[#ccc] h-[30px] flex items-center px-2 bg-white">
              <span className="text-[11px] text-black">99 €</span>
            </div>
            <span className="text-[11px] text-[#888]">—</span>
            <div className="flex-1 border border-[#ccc] h-[30px] flex items-center px-2 bg-white">
              <span className="text-[11px] text-black">1 200 €</span>
            </div>
          </div>
          <div className="h-[3px] bg-[#DDD] relative mx-[3px] mt-[6px]">
            <div className="absolute left-[10%] right-[34%] top-0 h-[3px] bg-[#E8001D]" />
            <div className="absolute top-[-5px] w-[13px] h-[13px] border-2 border-[#E8001D] bg-white rounded-full" style={{ left: "calc(10% - 6px)" }} />
            <div className="absolute top-[-5px] w-[13px] h-[13px] border-2 border-[#E8001D] bg-white rounded-full" style={{ right: "calc(34% - 6px)" }} />
          </div>
        </div>

        {/* Brand */}
        {brands.length > 0 && (
          <div className="mb-4 pb-4 border-b border-[#E2E2DE]">
            <p className="text-[11px] font-bold text-[#0D0D0D] mb-[10px]">Tootja</p>
            <div className="flex flex-col gap-[9px]">
              {brands.map((b) => {
                const on = activeBrands.includes(b.name)
                return (
                  <label key={b.name} className="flex items-center gap-2 cursor-pointer">
                    <span
                      onClick={() => toggle(activeBrands, setActiveBrands, b.name)}
                      className={`w-[15px] h-[15px] flex items-center justify-center flex-shrink-0 border ${
                        on ? "bg-[#0D0D0D] border-[#0D0D0D]" : "bg-white border-[#ccc]"
                      }`}
                    >
                      {on && (
                        <svg width="9" height="9" viewBox="0 0 8 8" fill="none">
                          <polyline points="1,4 3,6.5 7,1.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      )}
                    </span>
                    <span className={`text-[12px] ${on ? "font-semibold text-[#0D0D0D]" : "text-[#555]"}`}>
                      {b.name} <span className="text-[#aaa] font-normal">({b.count})</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        )}

        <button className="w-full bg-[#E8001D] text-white text-[12px] font-bold py-[11px] tracking-[.04em] uppercase hover:bg-red-700 transition-colors">
          Rakenda filtrid
        </button>
      </aside>

      {/* ── PRODUCT AREA ────────────────────────────────────────────── */}
      <div className="flex-1 p-[18px_24px] flex flex-col">
        <div className="flex items-center justify-between mb-4 pb-[14px] border-b border-[#EEE]">
          <div className="flex items-center gap-[10px] flex-wrap">
            <span className="text-[13px] text-[#555]">
              <strong className="text-[#0D0D0D]">{sorted.length}</strong> toodet
            </span>
            {activeSubs.map((s) => (
              <span
                key={s}
                onClick={() => setActiveSubs(activeSubs.filter((x) => x !== s))}
                className="inline-flex items-center gap-[6px] border border-[#0D0D0D] px-[9px] py-1 text-[11px] font-semibold text-[#0D0D0D] cursor-pointer hover:bg-[#0D0D0D] hover:text-white transition-colors"
              >
                {s} <span className="text-[13px] leading-none">×</span>
              </span>
            ))}
          </div>
          <div className="relative">
            <button
              onClick={() => setSortOpen((o) => !o)}
              className="border border-[#ccc] px-3 py-[6px] flex items-center gap-2 cursor-pointer bg-white"
            >
              <span className="text-[12px] text-[#888]">Sorteeri:</span>
              <span className="text-[12px] text-[#0D0D0D]">{SORT_LABELS[sort]}</span>
              <span className="text-[10px] text-[#888]">▼</span>
            </button>
            {sortOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-[#ddd] shadow-lg z-20 w-[200px]">
                {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                  <button
                    key={k}
                    onClick={() => { setSort(k); setSortOpen(false) }}
                    className={`block w-full text-left px-3 py-2 text-[12px] hover:bg-[#F6F6F4] ${
                      sort === k ? "text-[#E8001D] font-semibold" : "text-[#0D0D0D]"
                    }`}
                  >
                    {SORT_LABELS[k]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {sorted.map((p) => (
            <ProductCardPLP key={p.id} product={p} onAddToCart={addToCart} />
          ))}
        </div>

        {/* pagination */}
        {totalPages > 1 && (
          <div className="flex items-center mt-8 pt-4 flex-wrap">
            <PageLink slug={category.slug} to={page - 1} disabled={page <= 1} label="←" />
            {pageWindow(page, totalPages).map((n) =>
              n === "…" ? (
                <span key={`gap-${Math.random()}`} className="px-2 text-[12px] text-[#888]">…</span>
              ) : (
                <PageLink key={n} slug={category.slug} to={n as number} active={n === page} label={String(n)} />
              )
            )}
            <PageLink slug={category.slug} to={page + 1} disabled={page >= totalPages} label="→" />
          </div>
        )}
      </div>
    </div>
  )
}

// Compact page window: 1 … (p-1) p (p+1) … last
function pageWindow(page: number, total: number): (number | "…")[] {
  const set = new Set<number>([1, total, page, page - 1, page + 1])
  const pages = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b)
  const out: (number | "…")[] = []
  let prev = 0
  for (const n of pages) {
    if (n - prev > 1) out.push("…")
    out.push(n)
    prev = n
  }
  return out
}

function PageLink({
  slug, to, label, active, disabled,
}: {
  slug: string
  to: number
  label: string
  active?: boolean
  disabled?: boolean
}) {
  const base =
    "border border-[#DDD] border-l-0 first:border-l px-[13px] py-2 text-[12px]"
  if (disabled) {
    return <span className={`${base} text-[#ccc]`}>{label}</span>
  }
  if (active) {
    return <span className={`${base} font-bold text-white bg-[#E8001D] border-[#E8001D]`}>{label}</span>
  }
  return (
    <Link href={`/kategooriad/${slug}?page=${to}`} className={`${base} text-[#0D0D0D] hover:bg-[#F6F6F4]`}>
      {label}
    </Link>
  )
}
