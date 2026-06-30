/**
 * configurator-price.ts — pure pricing math for the PDP configurator.
 *
 * Extracted so it can be unit-tested independently of React. The server route
 * `POST /store/carts/:id/configure` is the *authority* on price (anti-tamper);
 * this mirrors the same rules for the live PDP display. Keep the two in sync.
 *
 * All amounts here are in **cents**; option deltas from Magento are in EUR major
 * units (fixed) or a percentage of the base.
 */

import type { CustomOption } from "./sample-data"

export type Selections = {
  single: Record<number, number> // optionId → value_id
  multi: Record<number, number[]> // optionId → value_ids
  text: Record<number, string> // optionId → entered text
}

/** Surcharge in cents for the current selections. */
export function computeSurchargeCents(
  options: CustomOption[],
  selections: Selections,
  basePriceCents: number
): number {
  const delta = (price: number, priceType: string) =>
    priceType === "percent" ? (basePriceCents * price) / 100 : price * 100

  let cents = 0
  for (const opt of options) {
    if (opt.type === "checkbox" || opt.type === "multiple") {
      for (const vid of selections.multi[opt.id] || []) {
        const v = opt.values.find((x) => x.id === vid)
        if (v) cents += delta(v.price, v.price_type)
      }
    } else if (opt.type === "field" || opt.type === "area") {
      if (selections.text[opt.id]) cents += delta(opt.price, opt.price_type)
    } else {
      const v = opt.values.find((x) => x.id === selections.single[opt.id])
      if (v) cents += delta(v.price, v.price_type)
    }
  }
  return Math.round(cents)
}

/** True when a required option has no selection yet (blocks add-to-cart). */
export function hasMissingRequired(options: CustomOption[], selections: Selections): boolean {
  return options.some((opt) => {
    if (!opt.required) return false
    if (opt.type === "checkbox" || opt.type === "multiple") return !(selections.multi[opt.id]?.length)
    if (opt.type === "field" || opt.type === "area") return !selections.text[opt.id]?.trim()
    return selections.single[opt.id] == null
  })
}
