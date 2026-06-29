import { Header } from "@/components/layout/Header"
import { CheckoutClient } from "@/components/checkout/CheckoutClient"

export const metadata = { title: "Kassa" }

export default function CheckoutPage() {
  return (
    <>
      <Header />
      <CheckoutClient />
    </>
  )
}
