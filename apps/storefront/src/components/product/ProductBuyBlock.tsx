"use client"

import { useState, useMemo } from "react"
import type { SampleProduct, CustomOption } from "@/lib/sample-data"
import { useCart } from "@/lib/cart-context"
import type { ConfigSelection } from "@/lib/store-client"
import { computeSurchargeCents, hasMissingRequired } from "@/lib/configurator-price"

const eur = (cents: number) => `${(cents / 100).toFixed(2).replace(".", ",")} €`

export function ProductBuyBlock({ product }: { product: SampleProduct }) {
  const { addConfigured, addVariant, loading } = useCart()
  const options = product.custom_options ?? []
  const basePrice = product.special_price ?? product.price // cents
  const [qty, setQty] = useState(1)

  // selection state: optionId → value_id (single) | value_ids[] (checkbox) | text
  const [single, setSingle] = useState<Record<number, number>>({})
  const [multi, setMulti] = useState<Record<number, number[]>>({})
  const [text, setText] = useState<Record<number, string>>({})

  // live surcharge (cents) — shared pure logic, unit-tested in configurator-price.test.ts
  const surcharge = useMemo(
    () => computeSurchargeCents(options, { single, multi, text }, basePrice),
    [options, single, multi, text, basePrice]
  )
  const total = basePrice + surcharge
  const missingRequired = hasMissingRequired(options, { single, multi, text })

  const buildSelections = (): ConfigSelection[] => {
    const sel: ConfigSelection[] = []
    for (const opt of options) {
      if (opt.type === "checkbox" || opt.type === "multiple") {
        if (multi[opt.id]?.length) sel.push({ option_id: opt.id, value_ids: multi[opt.id] })
      } else if (opt.type === "field" || opt.type === "area") {
        if (text[opt.id]?.trim()) sel.push({ option_id: opt.id, text: text[opt.id].trim() })
      } else if (single[opt.id] != null) {
        sel.push({ option_id: opt.id, value_id: single[opt.id] })
      }
    }
    return sel
  }

  async function add() {
    if (!product.variant_id || missingRequired) return
    if (options.length) {
      await addConfigured(product.variant_id, qty, buildSelections())
    } else {
      await addVariant(product.variant_id, qty)
    }
  }

  return (
    <>
      {/* ── Configurable options ─────────────────────────────────────── */}
      {options.map((opt) => (
        <OptionField
          key={opt.id}
          opt={opt}
          basePrice={basePrice}
          single={single[opt.id]}
          multi={multi[opt.id] || []}
          text={text[opt.id] || ""}
          onSingle={(vid) => setSingle((s) => ({ ...s, [opt.id]: vid }))}
          onMulti={(vid) =>
            setMulti((m) => {
              const cur = m[opt.id] || []
              return { ...m, [opt.id]: cur.includes(vid) ? cur.filter((x) => x !== vid) : [...cur, vid] }
            })
          }
          onText={(t) => setText((s) => ({ ...s, [opt.id]: t }))}
        />
      ))}

      {/* ── Qty + total + CTA ────────────────────────────────────────── */}
      {options.length > 0 && (
        <div className="flex items-baseline justify-between mt-5 mb-2">
          <span className="text-[12px] text-[#888]">Kokku</span>
          <span className="text-[24px] font-extrabold text-[#E8001D]">{eur(total)}</span>
        </div>
      )}

      <div className="flex gap-[10px] mt-3">
        <div className="flex items-center border border-[#ccc] flex-shrink-0">
          <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-10 h-12 bg-white text-[18px] text-[#0D0D0D] hover:bg-[#F6F6F4]">−</button>
          <span className="w-10 text-center text-[15px] font-bold text-[#0D0D0D] border-x border-[#DDD] h-12 flex items-center justify-center">{qty}</span>
          <button onClick={() => setQty((q) => q + 1)} className="w-10 h-12 bg-white text-[18px] text-[#0D0D0D] hover:bg-[#F6F6F4]">+</button>
        </div>
        <button
          onClick={add}
          disabled={loading || missingRequired || !product.variant_id}
          className="flex-1 bg-[#E8001D] text-white text-[15px] font-bold tracking-[.02em] hover:bg-red-700 transition-colors h-12 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Lisan…" : "Lisa ostukorvi →"}
        </button>
        <button aria-label="Lisa soovinimekirja" className="w-12 h-12 bg-white border border-[#DDD] flex items-center justify-center flex-shrink-0 hover:border-[#E8001D] group">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.6" className="group-hover:stroke-[#E8001D]">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>
      {missingRequired && (
        <p className="text-[12px] text-[#999] mt-2">Palun vali kõik kohustuslikud valikud.</p>
      )}
    </>
  )
}

function priceLabel(delta: number, basePrice: number, priceType: string): string {
  if (!delta) return ""
  const cents = priceType === "percent" ? (basePrice * delta) / 100 : delta * 100
  return ` (+${(cents / 100).toFixed(2).replace(".", ",")} €)`
}

function OptionField({
  opt, basePrice, single, multi, text, onSingle, onMulti, onText,
}: {
  opt: CustomOption
  basePrice: number
  single?: number
  multi: number[]
  text: string
  onSingle: (vid: number) => void
  onMulti: (vid: number) => void
  onText: (t: string) => void
}) {
  return (
    <div className="mb-4">
      <p className="text-[11px] font-bold tracking-[.06em] uppercase text-[#0D0D0D] mb-2">
        {opt.title}
        {opt.required && <span className="text-[#E8001D]"> *</span>}
      </p>

      {opt.type === "drop_down" && (
        <select
          value={single ?? ""}
          onChange={(e) => onSingle(Number(e.target.value))}
          className="w-full h-[42px] border border-[#DDD] px-3 text-[14px] text-[#0D0D0D] bg-white focus:border-[#E8001D] focus:outline-none"
        >
          <option value="" disabled>Vali…</option>
          {opt.values.map((v) => (
            <option key={v.id} value={v.id}>{v.title}{priceLabel(v.price, basePrice, v.price_type)}</option>
          ))}
        </select>
      )}

      {opt.type === "radio" && (
        <div className="flex flex-col gap-2">
          {opt.values.map((v) => (
            <label key={v.id} className={`flex items-center gap-2 border p-[10px] cursor-pointer ${single === v.id ? "border-[#E8001D] bg-[#fff5f6]" : "border-[#DDD]"}`}>
              <input type="radio" name={`opt-${opt.id}`} checked={single === v.id} onChange={() => onSingle(v.id)} className="accent-[#E8001D]" />
              <span className="text-[13px] text-[#0D0D0D]">{v.title}{priceLabel(v.price, basePrice, v.price_type)}</span>
            </label>
          ))}
        </div>
      )}

      {(opt.type === "checkbox" || opt.type === "multiple") && (
        <div className="flex flex-col gap-2">
          {opt.values.map((v) => (
            <label key={v.id} className={`flex items-center gap-2 border p-[10px] cursor-pointer ${multi.includes(v.id) ? "border-[#E8001D] bg-[#fff5f6]" : "border-[#DDD]"}`}>
              <input type="checkbox" checked={multi.includes(v.id)} onChange={() => onMulti(v.id)} className="accent-[#E8001D]" />
              <span className="text-[13px] text-[#0D0D0D]">{v.title}{priceLabel(v.price, basePrice, v.price_type)}</span>
            </label>
          ))}
        </div>
      )}

      {opt.type === "field" && (
        <input
          value={text}
          onChange={(e) => onText(e.target.value)}
          placeholder="Sisesta…"
          className="w-full h-[42px] border border-[#DDD] px-3 text-[14px] focus:border-[#E8001D] focus:outline-none"
        />
      )}

      {opt.type === "area" && (
        <textarea
          value={text}
          onChange={(e) => onText(e.target.value)}
          rows={3}
          placeholder="Sisesta…"
          className="w-full border border-[#DDD] p-3 text-[14px] focus:border-[#E8001D] focus:outline-none"
        />
      )}
    </div>
  )
}
