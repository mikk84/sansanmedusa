"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { AnnouncementBar } from "./AnnouncementBar"
import { MegaMenu } from "./MegaMenu"
import { CartDrawer } from "../cart/CartDrawer"
import { SearchBar } from "../ui/SearchBar"

const NAV_LINKS = [
  { label: "Vannid", href: "/kategooriad/vannid" },
  { label: "Dušinurgad", href: "/kategooriad/dusinurgad" },
  { label: "WC-potid", href: "/kategooriad/wc-potid" },
  { label: "Segistid", href: "/kategooriad/segistid" },
  { label: "Valamud", href: "/kategooriad/valamud" },
  { label: "Mööbel", href: "/kategooriad/mooebel" },
  { label: "Saun", href: "/kategooriad/saun" },
]

export function Header({ cartCount = 0, cartTotal = 0 }: {
  cartCount?: number
  cartTotal?: number
}) {
  const [megaOpen, setMegaOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  return (
    <>
      <header className="sticky top-0 z-50 w-full">
        <AnnouncementBar />

        {/* Logo row */}
        <div
          className="h-[72px] bg-[#111] px-[--page-px] flex items-center"
          style={{ paddingLeft: "var(--page-px)", paddingRight: "var(--page-px)" }}
        >
          <Link href="/" className="flex-shrink-0">
            <Image
              src="/logo.png"
              alt="SanSan"
              width={120}
              height={56}
              className="h-14 w-auto"
              priority
            />
          </Link>

          <div className="flex-1 flex justify-center px-10">
            <SearchBar />
          </div>

          <div className="flex items-center gap-[22px] flex-shrink-0">
            {/* Account */}
            <Link
              href="/konto"
              className="flex items-center gap-[7px] group"
              aria-label="Konto"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none"
                stroke="rgba(255,255,255,.6)" strokeWidth="1.5" className="group-hover:stroke-white transition-colors">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span className="text-[12px] text-white/60 group-hover:text-white transition-colors hidden lg:block">
                Konto
              </span>
            </Link>

            {/* Cart */}
            <button
              onClick={() => setCartOpen(true)}
              className="relative flex items-center gap-[7px] group"
              aria-label={`Ostukorv, ${cartCount} toodet`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="#fff" strokeWidth="1.5">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              <span className="text-[12px] text-white font-semibold hidden lg:block">
                Ostukorv{cartTotal > 0 ? ` · ${(cartTotal / 100).toFixed(0)} €` : ""}
              </span>
              {cartCount > 0 && (
                <span className="absolute -top-[7px] left-[11px] bg-[#E8001D] text-white text-[9px] font-bold min-w-[15px] h-[15px] rounded-full flex items-center justify-center px-[3px]">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Nav row */}
        <div
          className="h-[46px] bg-[#111] border-t border-white/[0.07] flex items-center"
          style={{ paddingLeft: "var(--page-px)", paddingRight: "var(--page-px)" }}
        >
          {/* All categories trigger */}
          <button
            onClick={() => setMegaOpen((v) => !v)}
            onMouseEnter={() => setMegaOpen(true)}
            className="flex items-center gap-2 bg-[#E8001D] h-full px-4 mr-2 flex-shrink-0 cursor-pointer"
            aria-expanded={megaOpen}
            aria-controls="mega-menu"
          >
            <div className="flex flex-col gap-[3px]">
              <span className="w-[15px] h-[2px] bg-white block" />
              <span className="w-[15px] h-[2px] bg-white block" />
              <span className="w-[15px] h-[2px] bg-white block" />
            </div>
            <span className="text-[11px] font-bold tracking-[.07em] uppercase text-white hidden sm:block">
              Kõik kategooriad
            </span>
          </button>

          {/* Top-level nav links */}
          <nav className="flex-1 flex items-center justify-between">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[11px] font-semibold tracking-[.06em] uppercase text-white/62 hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/soodushinnaga"
              className="text-[11px] font-bold tracking-[.06em] uppercase text-[#E8001D] hover:text-red-400 transition-colors"
            >
              Soodushinnaga −40%
            </Link>
          </nav>
        </div>
      </header>

      {/* Mega menu dropdown */}
      {megaOpen && (
        <MegaMenu
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          onClose={() => setMegaOpen(false)}
        />
      )}

      {/* Cart drawer */}
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  )
}
