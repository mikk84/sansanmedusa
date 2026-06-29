"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useCart } from "@/lib/cart-context"
import {
  listShippingOptions,
  addShippingMethod,
  updateCart,
  initPaymentCollection,
  initPaymentSession,
  completeCart,
} from "@/lib/store-client"

const PAYMENT_PROVIDER = "pp_system_default" // demo; Montonio swapped in later
const toCents = (n: number | undefined | null) => Math.round((n ?? 0) * 100)
const eur = (cents: number) => `${(cents / 100).toFixed(2)} €`

type Form = {
  email: string
  first_name: string
  last_name: string
  phone: string
  address_1: string
  postal_code: string
  city: string
}

const EMPTY: Form = {
  email: "", first_name: "", last_name: "", phone: "",
  address_1: "", postal_code: "", city: "",
}

export function CheckoutClient() {
  const { cart, total, refresh, clearCart } = useCart()
  const [form, setForm] = useState<Form>(EMPTY)
  const [shippingOptions, setShippingOptions] = useState<any[]>([])
  const [selectedOption, setSelectedOption] = useState<string>("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [order, setOrder] = useState<any | null>(null)

  const cartId = cart?.id
  const items = cart?.items ?? []

  // Load shipping options once a cart exists.
  useEffect(() => {
    if (!cartId) return
    listShippingOptions(cartId)
      .then((opts) => {
        setShippingOptions(opts)
        if (opts[0]) setSelectedOption(opts[0].id)
      })
      .catch(() => {})
  }, [cartId])

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const shippingAmount =
    toCents(cart?.shipping_methods?.[0]?.amount) ||
    toCents(shippingOptions.find((o) => o.id === selectedOption)?.amount)
  const grandTotal = total + shippingAmount

  const valid =
    form.email && form.first_name && form.last_name &&
    form.address_1 && form.postal_code && form.city && selectedOption && items.length

  async function placeOrder() {
    if (!cartId || !valid) return
    setSubmitting(true)
    setError(null)
    try {
      const address = {
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone,
        address_1: form.address_1,
        postal_code: form.postal_code,
        city: form.city,
        country_code: "ee",
      }
      await updateCart(cartId, {
        email: form.email,
        shipping_address: address,
        billing_address: address,
      })
      await addShippingMethod(cartId, selectedOption)
      const pc = await initPaymentCollection(cartId)
      await initPaymentSession(pc.id, PAYMENT_PROVIDER)
      const result = await completeCart(cartId)
      if (result.type === "order") {
        setOrder(result.order)
        clearCart()
      } else {
        setError(result.error || "Tellimuse vormistamine ebaõnnestus.")
      }
    } catch (e: any) {
      setError(e.message || "Midagi läks valesti.")
    } finally {
      setSubmitting(false)
    }
  }

  // ── Order confirmation ─────────────────────────────────────────────────────
  if (order) {
    return (
      <main className="max-w-[640px] mx-auto px-6 py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-[#2a7a2a] flex items-center justify-center mx-auto mb-6">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 className="text-[28px] font-extrabold text-[#0D0D0D] mb-3">Aitäh tellimuse eest!</h1>
        <p className="text-[15px] text-[#555] mb-2">
          Sinu tellimus <strong>#{order.display_id}</strong> on vastu võetud.
        </p>
        <p className="text-[14px] text-[#777] mb-8">
          Saatsime kinnituse aadressile {order.email}. Võtame ühendust tarne osas.
        </p>
        <Link href="/" className="inline-block bg-[#E8001D] text-white text-[15px] font-bold px-8 py-[14px] hover:bg-red-700 transition-colors">
          Tagasi avalehele →
        </Link>
      </main>
    )
  }

  // ── Empty cart ──────────────────────────────────────────────────────────────
  if (cart && items.length === 0) {
    return (
      <main className="max-w-[640px] mx-auto px-6 py-20 text-center">
        <h1 className="text-[24px] font-extrabold text-[#0D0D0D] mb-3">Ostukorv on tühi</h1>
        <p className="text-[14px] text-[#777] mb-8">Lisa tooteid, et vormistada tellimus.</p>
        <Link href="/" className="inline-block bg-[#E8001D] text-white text-[15px] font-bold px-8 py-[14px] hover:bg-red-700 transition-colors">
          Jätka ostlemist →
        </Link>
      </main>
    )
  }

  return (
    <main className="max-w-[1100px] mx-auto px-6 py-8">
      <h1 className="text-[24px] font-extrabold text-[#0D0D0D] mb-6">Kassa</h1>

      <div className="flex flex-col lg:flex-row gap-10">
        {/* ── LEFT: form ──────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-8">
          {/* Contact */}
          <section>
            <h2 className="text-[12px] font-bold tracking-[.12em] uppercase text-[#0D0D0D] mb-4">
              1 · Kontakt
            </h2>
            <Field label="E-post" value={form.email} onChange={set("email")} type="email" placeholder="sinu@email.ee" />
          </section>

          {/* Shipping address */}
          <section>
            <h2 className="text-[12px] font-bold tracking-[.12em] uppercase text-[#0D0D0D] mb-4">
              2 · Tarneaadress
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Eesnimi" value={form.first_name} onChange={set("first_name")} />
              <Field label="Perekonnanimi" value={form.last_name} onChange={set("last_name")} />
            </div>
            <Field label="Telefon" value={form.phone} onChange={set("phone")} type="tel" placeholder="+372 …" />
            <Field label="Aadress" value={form.address_1} onChange={set("address_1")} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Sihtnumber" value={form.postal_code} onChange={set("postal_code")} />
              <Field label="Linn" value={form.city} onChange={set("city")} />
            </div>
            <p className="text-[12px] text-[#999] mt-1">Riik: Eesti</p>
          </section>

          {/* Delivery */}
          <section>
            <h2 className="text-[12px] font-bold tracking-[.12em] uppercase text-[#0D0D0D] mb-4">
              3 · Tarneviis
            </h2>
            <div className="flex flex-col gap-2">
              {shippingOptions.map((o) => (
                <label
                  key={o.id}
                  className={`flex items-center justify-between border p-[14px] cursor-pointer ${
                    selectedOption === o.id ? "border-[#E8001D] bg-[#fff5f6]" : "border-[#DDD]"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="shipping"
                      checked={selectedOption === o.id}
                      onChange={() => setSelectedOption(o.id)}
                      className="accent-[#E8001D]"
                    />
                    <span className="text-[14px] font-semibold text-[#0D0D0D]">{o.name}</span>
                  </span>
                  <span className="text-[14px] font-bold text-[#0D0D0D]">{eur(toCents(o.amount))}</span>
                </label>
              ))}
              {!shippingOptions.length && (
                <p className="text-[13px] text-[#999]">Laadin tarneviise…</p>
              )}
            </div>
          </section>

          {/* Payment */}
          <section>
            <h2 className="text-[12px] font-bold tracking-[.12em] uppercase text-[#0D0D0D] mb-4">
              4 · Makseviis
            </h2>
            <div className="border border-[#E8001D] bg-[#fff5f6] p-[14px] flex items-center gap-3">
              <input type="radio" checked readOnly className="accent-[#E8001D]" />
              <span className="text-[14px] font-semibold text-[#0D0D0D]">Pangalink / kaart (Montonio)</span>
            </div>
            <p className="text-[12px] text-[#999] mt-2">
              Demo-keskkonnas vormistatakse makse testrežiimis. Montonio pangalingid ja
              järelmaks aktiveeritakse päris kontoga.
            </p>
          </section>

          {error && (
            <div className="border border-[#E8001D] bg-[#fff5f6] text-[#E8001D] text-[13px] p-3">
              {error}
            </div>
          )}
        </div>

        {/* ── RIGHT: summary ──────────────────────────────────────── */}
        <aside className="w-full lg:w-[360px] flex-shrink-0">
          <div className="border border-[#EAEAEA] p-5 sticky top-[140px]">
            <h2 className="text-[12px] font-bold tracking-[.12em] uppercase text-[#0D0D0D] mb-4">
              Sinu tellimus
            </h2>
            <div className="flex flex-col gap-3 max-h-[320px] overflow-y-auto mb-4">
              {items.map((it: any) => (
                <div key={it.id} className="flex gap-3">
                  <div className="w-[54px] h-[54px] border border-[#EAEAEA] flex-shrink-0 relative bg-white">
                    {it.thumbnail ? (
                      <Image src={it.thumbnail} alt="" fill className="object-contain p-1" sizes="54px" />
                    ) : (
                      <div className="img-placeholder w-full h-full" />
                    )}
                    <span className="absolute -top-2 -right-2 bg-[#111] text-white text-[10px] font-bold w-[18px] h-[18px] rounded-full flex items-center justify-center">
                      {it.quantity}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-[#0D0D0D] leading-snug line-clamp-2">
                      {it.product_title || it.title}
                    </p>
                  </div>
                  <span className="text-[12px] font-bold text-[#0D0D0D] whitespace-nowrap">
                    {eur(toCents(it.unit_price) * it.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-[#EEE] pt-3 flex flex-col gap-2">
              <Row label="Vahesumma" value={eur(total)} />
              <Row label="Tarne" value={shippingAmount ? eur(shippingAmount) : "—"} />
              <div className="flex justify-between items-baseline pt-2 border-t border-[#EEE] mt-1">
                <span className="text-[14px] font-bold text-[#0D0D0D]">Kokku</span>
                <span className="text-[20px] font-extrabold text-[#0D0D0D]">{eur(grandTotal)}</span>
              </div>
              <p className="text-[11px] text-[#999]">Sisaldab 22% käibemaksu</p>
            </div>

            <button
              onClick={placeOrder}
              disabled={!valid || submitting}
              className="w-full mt-5 bg-[#E8001D] text-white text-[15px] font-bold py-[15px] hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Vormistan…" : "Maksa ja vormista →"}
            </button>
            <Link href="/" className="block text-center text-[12px] text-[#999] mt-3 hover:text-[#0D0D0D]">
              ← Tagasi poodi
            </Link>
          </div>
        </aside>
      </div>
    </main>
  )
}

function Field({
  label, value, onChange, type = "text", placeholder,
}: {
  label: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  type?: string
  placeholder?: string
}) {
  return (
    <label className="block mb-3">
      <span className="block text-[11px] font-semibold text-[#666] mb-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full h-[42px] border border-[#DDD] px-3 text-[14px] text-[#0D0D0D] focus:border-[#E8001D] focus:outline-none"
      />
    </label>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-[13px] text-[#666]">{label}</span>
      <span className="text-[13px] text-[#0D0D0D]">{value}</span>
    </div>
  )
}
