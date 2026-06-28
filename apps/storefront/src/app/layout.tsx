import type { Metadata } from "next"
import { DM_Sans } from "next/font/google"
import "./globals.css"

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-dm-sans",
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "SanSan — Sanitaartehnika veebipood",
    template: "%s | SanSan",
  },
  description:
    "Eesti suurim valik sanitaartehnikat — üle 10 000 toote laos, tarne 1–2 tööpäeva üle Eesti.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "https://sansan.ee"),
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="et" className={dmSans.variable}>
      <body>{children}</body>
    </html>
  )
}
