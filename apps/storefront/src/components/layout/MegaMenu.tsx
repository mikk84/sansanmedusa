"use client"

import Link from "next/link"
import { useEffect, useRef } from "react"

const CATEGORIES = [
  {
    slug: "vannid",
    label: "Vannid",
    total: 124,
    subcategories: [
      { heading: "Tüübi järgi", links: ["Akrüülvannid", "Valumassist vannid", "Terasvannid", "Nurgavannid", "Vabaltseisvad vannid", "Massaaživannid"] },
      { heading: "Mõõdu järgi", links: ["150 × 70 cm", "160 × 70 cm", "170 × 75 cm", "180 × 80 cm", "Eritellimusel"] },
      { heading: "Lisatarvikud", links: ["Vannisirmid", "Vanni jalad & raamid", "Äravoolukomplektid", "Vannisegistid", "Vanni eespaneelid"] },
    ],
    brands: ["Ravak", "Duravit", "Kaldewei", "Riho", "Villeroy & Boch"],
  },
  { slug: "dusinurgad", label: "Dušinurgad & -seinad", total: 98, subcategories: [], brands: [] },
  { slug: "wc-potid", label: "WC-potid & bideed", total: 56, subcategories: [], brands: [] },
  { slug: "segistid", label: "Segistid", total: 142, subcategories: [], brands: [] },
  { slug: "valamud", label: "Valamud", total: 87, subcategories: [], brands: [] },
  { slug: "mooebel", label: "Vannitoamööbel", total: 63, subcategories: [], brands: [] },
  { slug: "saun", label: "Saun", total: 45, subcategories: [], brands: [] },
  { slug: "kuete", label: "Küte & radiaatorid", total: 38, subcategories: [], brands: [] },
  { slug: "aksessuaarid", label: "Aksessuaarid", total: 211, subcategories: [], brands: [] },
]

type Props = {
  activeCategory: string | null
  onCategoryChange: (slug: string | null) => void
  onClose: () => void
}

export function MegaMenu({ activeCategory, onCategoryChange, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const active = CATEGORIES.find((c) => c.slug === activeCategory) || CATEGORIES[0]

  // Close on click outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      id="mega-menu"
      className="absolute left-0 right-0 z-40 bg-white shadow-[0_8px_32px_rgba(0,0,0,.16)] flex"
      style={{ top: "calc(var(--header-h-announcement) + var(--header-h-logo) + var(--header-h-nav))" }}
      onMouseLeave={onClose}
    >
      {/* Left rail */}
      <div className="w-60 flex-shrink-0 bg-[#F6F6F4] border-r border-[#E8E8E5] py-3">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.slug}
            onMouseEnter={() => onCategoryChange(cat.slug)}
            className={`w-full flex items-center gap-[11px] px-[22px] py-[11px] border-l-[3px] text-left transition-colors ${
              active.slug === cat.slug
                ? "bg-white border-[#E8001D]"
                : "border-transparent hover:bg-white/60"
            }`}
          >
            <span className={`text-[13px] ${active.slug === cat.slug ? "font-bold text-[#0D0D0D]" : "font-medium text-[#444]"}`}>
              {cat.label}
            </span>
            <span className="ml-auto text-[14px] text-[#c4c4c4]">›</span>
          </button>
        ))}

        <div className="mx-[22px] mt-2.5 pt-3 border-t border-[#E2E2DE]">
          <Link
            href="/soodushinnaga"
            className="flex items-center gap-2 text-[12px] font-bold text-[#E8001D]"
            onClick={onClose}
          >
            ★ Soodushinnaga tooted
          </Link>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 p-6">
          <div className="flex items-baseline gap-3 mb-5">
            <h3 className="text-[18px] font-extrabold text-[#0D0D0D] tracking-tight">
              {active.label}
            </h3>
            <Link
              href={`/kategooriad/${active.slug}`}
              className="text-[12px] text-[#E8001D] font-semibold"
              onClick={onClose}
            >
              Vaata kõiki {active.total} toodet →
            </Link>
          </div>

          {active.subcategories.length > 0 ? (
            <div className="grid grid-cols-3 gap-x-7 gap-y-5">
              {active.subcategories.map((group) => (
                <div key={group.heading}>
                  <p className="text-[10px] font-bold tracking-[.1em] uppercase text-[#999] mb-[11px] pb-2 border-b border-[#EDEDEA]">
                    {group.heading}
                  </p>
                  <div className="flex flex-col gap-[9px]">
                    {group.links.map((link) => (
                      <Link
                        key={link}
                        href={`/kategooriad/${active.slug}?filter=${encodeURIComponent(link)}`}
                        className="text-[13px] text-[#333] hover:text-[#E8001D] transition-colors"
                        onClick={onClose}
                      >
                        {link}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-[#999]">Kategooria sisu lisatakse peagi.</p>
          )}

          {active.brands.length > 0 && (
            <div className="mt-6 pt-[18px] border-t border-[#EDEDEA]">
              <p className="text-[10px] font-bold tracking-[.1em] uppercase text-[#999] mb-3">
                Populaarsed tootjad
              </p>
              <div className="flex gap-[9px] flex-wrap">
                {active.brands.map((brand) => (
                  <Link
                    key={brand}
                    href={`/kategooriad/${active.slug}?brand=${encodeURIComponent(brand)}`}
                    className="border border-[#E0E0E0] px-[14px] py-[7px] text-[12px] font-semibold text-[#555] hover:border-[#E8001D] hover:text-[#E8001D] transition-colors"
                    onClick={onClose}
                  >
                    {brand}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
