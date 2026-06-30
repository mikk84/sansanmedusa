import { describe, it, expect } from "vitest"
import { computeSurchargeCents, hasMissingRequired, type Selections } from "./configurator-price"
import type { CustomOption } from "./sample-data"

// Mirrors the real "Dušinurk Duschy Square" options (base 553 €).
const doorWidth: CustomOption = {
  id: 936, title: "Ukse laius", type: "drop_down", required: true, price: 0, price_type: "fixed",
  values: [
    { id: 1, title: "70 cm", price: 0, price_type: "fixed" },
    { id: 2, title: "80 cm", price: 13, price_type: "fixed" },
    { id: 3, title: "100 cm", price: 38, price_type: "fixed" },
  ],
}
const wallWidth: CustomOption = {
  id: 937, title: "Seina laius", type: "drop_down", required: true, price: 0, price_type: "fixed",
  values: [
    { id: 10, title: "70 cm", price: 0, price_type: "fixed" },
    { id: 11, title: "90 cm", price: 14, price_type: "fixed" },
  ],
}
const glass: CustomOption = {
  id: 934, title: "Klaasi toon", type: "radio", required: true, price: 0, price_type: "fixed",
  values: [
    { id: 20, title: "Kirgas", price: 0, price_type: "fixed" },
    { id: 21, title: "Toonitud", price: 23, price_type: "fixed" },
  ],
}
const extras: CustomOption = {
  id: 50, title: "Lisad", type: "checkbox", required: false, price: 0, price_type: "fixed",
  values: [
    { id: 30, title: "Hoolduskomplekt", price: 9, price_type: "fixed" },
    { id: 31, title: "Lisariiul", price: 15, price_type: "fixed" },
  ],
}
const engraving: CustomOption = {
  id: 60, title: "Graveering", type: "field", required: false, price: 5, price_type: "fixed",
  values: [],
}
const percentOpt: CustomOption = {
  id: 70, title: "Kindlustus", type: "radio", required: false, price: 0, price_type: "fixed",
  values: [{ id: 40, title: "10% lisakaitse", price: 10, price_type: "percent" }],
}

const BASE = 55300 // 553 € in cents
const empty: Selections = { single: {}, multi: {}, text: {} }

describe("computeSurchargeCents", () => {
  it("is zero with no selections", () => {
    expect(computeSurchargeCents([doorWidth, wallWidth, glass], empty, BASE)).toBe(0)
  })

  it("sums fixed deltas across selects + radio (the Duschy Square case)", () => {
    const sel: Selections = { single: { 936: 3, 937: 11 }, multi: {}, text: {} }
    // door 100cm (+38) + wall 90cm (+14) = 52 €
    expect(computeSurchargeCents([doorWidth, wallWidth], sel, BASE)).toBe(5200)
    // + glass Toonitud (+23) = 75 € → total surcharge 7500c, grand total 628 €
    const withGlass: Selections = { single: { 936: 3, 937: 11, 934: 21 }, multi: {}, text: {} }
    const surcharge = computeSurchargeCents([doorWidth, wallWidth, glass], withGlass, BASE)
    expect(surcharge).toBe(7500)
    expect((BASE + surcharge) / 100).toBe(628)
  })

  it("zero-priced values add nothing", () => {
    const sel: Selections = { single: { 936: 1, 937: 10, 934: 20 }, multi: {}, text: {} }
    expect(computeSurchargeCents([doorWidth, wallWidth, glass], sel, BASE)).toBe(0)
  })

  it("sums multiple checkbox add-ons", () => {
    const sel: Selections = { single: {}, multi: { 50: [30, 31] }, text: {} }
    expect(computeSurchargeCents([extras], sel, BASE)).toBe(2400) // 9 + 15 €
  })

  it("charges a field option only when text is entered", () => {
    expect(computeSurchargeCents([engraving], empty, BASE)).toBe(0)
    const sel: Selections = { single: {}, multi: {}, text: { 60: "SanSan" } }
    expect(computeSurchargeCents([engraving], sel, BASE)).toBe(500) // +5 €
  })

  it("applies percent deltas against the base price", () => {
    const sel: Selections = { single: { 70: 40 }, multi: {}, text: {} }
    expect(computeSurchargeCents([percentOpt], sel, BASE)).toBe(5530) // 10% of 553 €
  })

  it("ignores unknown value ids", () => {
    const sel: Selections = { single: { 936: 999 }, multi: {}, text: {} }
    expect(computeSurchargeCents([doorWidth], sel, BASE)).toBe(0)
  })
})

describe("hasMissingRequired", () => {
  it("flags an unselected required option", () => {
    expect(hasMissingRequired([doorWidth, wallWidth, glass], empty)).toBe(true)
  })
  it("passes once all required options are chosen", () => {
    const sel: Selections = { single: { 936: 3, 937: 11, 934: 21 }, multi: {}, text: {} }
    expect(hasMissingRequired([doorWidth, wallWidth, glass], sel)).toBe(false)
  })
  it("ignores optional options", () => {
    expect(hasMissingRequired([extras, engraving], empty)).toBe(false)
  })
  it("requires text for a required field option", () => {
    const req = { ...engraving, required: true }
    expect(hasMissingRequired([req], empty)).toBe(true)
    expect(hasMissingRequired([req], { single: {}, multi: {}, text: { 60: "x" } })).toBe(false)
  })
})
