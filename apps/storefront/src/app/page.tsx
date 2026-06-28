import Image from "next/image"
import Link from "next/link"
import { Header } from "@/components/layout/Header"
import { ProductCard } from "@/components/product/ProductCard"

const CATEGORIES = [
  { slug: "vannid", label: "Vannid", count: 124 },
  { slug: "dusinurgad", label: "Dušinurgad", count: 98 },
  { slug: "wc-potid", label: "WC-potid", count: 56 },
  { slug: "segistid", label: "Segistid", count: 142 },
  { slug: "valamud", label: "Valamud", count: 87 },
  { slug: "mooebel", label: "Vannitoamööbel", count: 63 },
]

// In production these come from Medusa API / Meilisearch
const FEATURED_PRODUCTS = [
  { id: "1", slug: "vitra-s50-wc-komplekt", name: "S50 seinapealne WC-komplekt", brand: "VitrA", price: 48900, special_price: 39900 },
  { id: "2", slug: "hansgrohe-vernis-blend", name: "Vernis Blend valamusegisti", brand: "Hansgrohe", price: 12900 },
  { id: "3", slug: "ravak-chrome-dusisein-90", name: "Chrome dušisein 90 cm", brand: "Ravak", price: 27900, is_new: true },
  { id: "4", slug: "duravit-dcode-ii-wc-pott", name: "D-Code II seinapealne WC-pott", brand: "Duravit", price: 34900 },
]

export default function HomePage() {
  return (
    <>
      <Header />

      <main>
        {/* ── HERO ──────────────────────────────────────────────────── */}
        <section className="relative h-[300px] overflow-hidden bg-[#1a1a1a]">
          {/* Background lifestyle photo placeholder */}
          <div className="img-placeholder-dark absolute inset-0" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/72 via-black/34 to-transparent" />

          <div className="absolute top-0 bottom-0 left-[46px] flex flex-col justify-center max-w-[480px]">
            <span className="text-[11px] font-bold tracking-[.18em] uppercase text-white bg-[#E8001D] self-start px-[10px] py-[5px] mb-[14px]">
              Kevadkollektsioon 2026
            </span>
            <h1 className="text-[40px] font-extrabold leading-[1.02] text-white tracking-[-0.03em] mb-3">
              Loo vannituba,<br />mis kestab.
            </h1>
            <p className="text-[14px] text-white/78 leading-relaxed mb-5 max-w-[400px]">
              Eesti suurim valik sanitaartehnikat — üle 10 000 toote laos, tarne 1–2 tööpäeva üle Eesti.
            </p>
            <div className="flex gap-3 items-center">
              <Link
                href="/kategooriad"
                className="bg-[#E8001D] text-white text-[14px] font-bold px-7 py-[14px] hover:bg-red-700 transition-colors"
              >
                Vaata kollektsiooni →
              </Link>
              <Link
                href="/soodushinnaga"
                className="text-white text-[14px] font-medium py-[14px] px-1 border-b border-white/45 hover:border-white transition-colors"
              >
                Soodustooted
              </Link>
            </div>
          </div>
        </section>

        {/* ── CATEGORY STRIP ────────────────────────────────────────── */}
        <section className="px-[--page-px] pt-4" style={{ paddingLeft: "var(--page-px)", paddingRight: "var(--page-px)" }}>
          <div className="flex items-baseline justify-between mb-[14px]">
            <h2 className="text-[12px] font-bold tracking-[.12em] uppercase text-[#0D0D0D]">
              Sirvi kategooriaid
            </h2>
            <Link href="/kategooriad" className="text-[13px] text-[#E8001D] font-semibold hover:underline">
              Kõik 9 kategooriat →
            </Link>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {CATEGORIES.map((cat) => (
              <Link key={cat.slug} href={`/kategooriad/${cat.slug}`} className="group cursor-pointer">
                <div className="img-placeholder h-24 flex items-end p-2">
                  <span className="font-mono text-[8px] text-[#b3b0ab]">{cat.label.toLowerCase()}</span>
                </div>
                <div className="pt-2 px-[2px]">
                  <p className="text-[12px] font-semibold text-[#0D0D0D] group-hover:text-[#E8001D] transition-colors">
                    {cat.label}
                  </p>
                  <p className="text-[10px] text-[#999]">{cat.count} toodet</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── FEATURED PRODUCTS ─────────────────────────────────────── */}
        <section className="px-[--page-px] pt-2.5 pb-10" style={{ paddingLeft: "var(--page-px)", paddingRight: "var(--page-px)" }}>
          <div className="flex items-baseline justify-between mb-[14px]">
            <h2 className="text-[12px] font-bold tracking-[.12em] uppercase text-[#0D0D0D]">
              Nädala lemmikud
            </h2>
            <Link href="/tooted" className="text-[13px] text-[#E8001D] font-semibold hover:underline">
              Vaata kõiki →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-[14px]">
            {FEATURED_PRODUCTS.map((product) => (
              <ProductCard key={product.id} product={product as any} />
            ))}
          </div>
        </section>
      </main>
    </>
  )
}
