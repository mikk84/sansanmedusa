import Link from "next/link"
import { notFound } from "next/navigation"
import { Header } from "@/components/layout/Header"
import { CatalogView } from "@/components/product/CatalogView"
import {
  getCategoryByHandle,
  getProductsByCategoryHandle,
} from "@/lib/medusa"
import type { SampleBrand } from "@/lib/sample-data"

const PAGE_SIZE = 48

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { slug } = await params
  const { page: pageParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam || "1", 10) || 1)

  const catData = await getCategoryByHandle(slug)
  if (!catData) notFound()

  const { products, count } = await getProductsByCategoryHandle(
    slug,
    PAGE_SIZE,
    (page - 1) * PAGE_SIZE
  )
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  // Derive brand facets from the products actually in this category.
  const brandCounts = new Map<string, number>()
  for (const p of products) {
    if (p.brand) brandCounts.set(p.brand, (brandCounts.get(p.brand) ?? 0) + 1)
  }
  const brands: SampleBrand[] = [...brandCounts.entries()]
    .map(([name, n]) => ({ name, count: n }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  const category = { ...catData.category, count }

  return (
    <>
      <Header />

      {/* breadcrumb */}
      <div className="h-[38px] flex items-center px-[--page-px] border-b border-[#EEE] gap-[7px]"
        style={{ paddingLeft: "var(--page-px)", paddingRight: "var(--page-px)" }}>
        <Link href="/" className="text-[12px] text-[#999] hover:text-[#0D0D0D]">Avaleht</Link>
        <span className="text-[12px] text-[#ccc]">›</span>
        <span className="text-[12px] font-semibold text-[#0D0D0D]">{category.label}</span>
        <span className="text-[12px] text-[#bbb] ml-1">{count} toodet</span>
      </div>

      <CatalogView
        category={category}
        products={products}
        subcategories={catData.subcategories}
        brands={brands}
        page={page}
        totalPages={totalPages}
      />
    </>
  )
}
