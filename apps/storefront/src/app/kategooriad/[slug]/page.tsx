import Link from "next/link"
import { notFound } from "next/navigation"
import { Header } from "@/components/layout/Header"
import { CatalogView } from "@/components/product/CatalogView"
import {
  getCategoryBySlug,
  getProductsByCategory,
  SUBCATEGORIES,
  BRANDS_BY_CATEGORY,
  CATEGORIES,
} from "@/lib/sample-data"

// Pre-render the known categories. In production this list comes from Medusa.
export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.slug }))
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const category = getCategoryBySlug(slug)
  if (!category) notFound()

  const products = getProductsByCategory(slug)
  const subcategories = SUBCATEGORIES[slug] ?? []
  const brands = BRANDS_BY_CATEGORY[slug] ?? []

  return (
    <>
      <Header />

      {/* breadcrumb */}
      <div className="h-[38px] flex items-center px-[--page-px] border-b border-[#EEE] gap-[7px]"
        style={{ paddingLeft: "var(--page-px)", paddingRight: "var(--page-px)" }}>
        <Link href="/" className="text-[12px] text-[#999] hover:text-[#0D0D0D]">Avaleht</Link>
        <span className="text-[12px] text-[#ccc]">›</span>
        <span className="text-[12px] font-semibold text-[#0D0D0D]">{category.label}</span>
        <span className="text-[12px] text-[#bbb] ml-1">{category.count} toodet</span>
      </div>

      <CatalogView
        category={category}
        products={products}
        subcategories={subcategories}
        brands={brands}
      />
    </>
  )
}
