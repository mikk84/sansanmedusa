import { MedusaService } from "@medusajs/framework/utils"
import { Resend } from "resend"

/**
 * Generates a nicely-formatted Estonian VAT invoice as HTML (rendered to PDF
 * by the storefront or a headless browser), then emails it to the customer.
 *
 * Estonian VAT rate: 24% (standard, from 2025-07-01). VAT is taken from the
 * order's own tax lines; the rate here is display/fallback only.
 * Invoice must include: seller reg. no., VAT no., buyer details, line items,
 * subtotal excl. VAT, VAT amount, total incl. VAT.
 */
export class InvoiceModuleService extends MedusaService({}) {
  private resend: Resend

  constructor() {
    super(...arguments)
    this.resend = new Resend(process.env.RESEND_API_KEY)
  }

  async generateAndSend(order: any): Promise<{ invoice_number: string }> {
    const invoiceNumber = this.buildInvoiceNumber(order.display_id)
    const html = this.buildInvoiceHtml(order, invoiceNumber)

    await this.resend.emails.send({
      from: process.env.EMAIL_FROM || "tellimused@sansan.ee",
      to: order.customer.email,
      subject: `SanSan arve ${invoiceNumber}`,
      html: this.buildEmailWrapper(invoiceNumber, order.customer.first_name),
      attachments: [
        {
          filename: `${invoiceNumber}.html`,
          content: Buffer.from(html).toString("base64"),
          contentType: "text/html",
        },
      ],
    })

    return { invoice_number: invoiceNumber }
  }

  private buildInvoiceNumber(displayId: number): string {
    const now = new Date()
    const yy = String(now.getFullYear()).slice(2)
    const mm = String(now.getMonth() + 1).padStart(2, "0")
    return `SS-${yy}${mm}-${String(displayId).padStart(4, "0")}`
  }

  private buildInvoiceHtml(order: any, invoiceNumber: string): string {
    // Prefer the order's computed tax lines (authoritative); fall back to the
    // standard EE rate only if an order predates tax configuration.
    const VAT_RATE = 0.24 // EE standard VAT (display + fallback only)
    const grossTotal =
      order.total ??
      order.items.reduce((s: number, i: any) => s + i.unit_price * i.quantity, 0)
    const subtotalExclVat =
      order.item_subtotal ?? order.subtotal ?? grossTotal / (1 + VAT_RATE)
    const vatAmount = order.tax_total ?? grossTotal - subtotalExclVat
    const subtotal = grossTotal

    const issueDate = new Date().toLocaleDateString("et-EE")

    const itemRows = order.items
      .map(
        (item: any) => `
      <tr>
        <td>${item.title}</td>
        <td style="text-align:center">${item.quantity}</td>
        <td style="text-align:right">${fmt((item.unit_price ?? 0) / (1 + VAT_RATE))}</td>
        <td style="text-align:right">${fmt(item.subtotal ?? (item.unit_price * item.quantity) / (1 + VAT_RATE))}</td>
      </tr>`
      )
      .join("")

    return `<!DOCTYPE html>
<html lang="et">
<head>
<meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 13px; color: #111; margin: 40px; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 32px; }
  .seller, .buyer { width: 48%; }
  table { width: 100%; border-collapse: collapse; margin-top: 24px; }
  th { background: #111; color: #fff; padding: 8px 10px; text-align: left; font-size: 12px; }
  td { padding: 8px 10px; border-bottom: 1px solid #eee; }
  .totals { margin-top: 16px; text-align: right; }
  .totals td { padding: 4px 10px; border: none; }
  .totals .grand { font-size: 16px; font-weight: bold; }
  .red { color: #E8001D; }
</style>
</head>
<body>
<h1>ARVE <span class="red">${invoiceNumber}</span></h1>
<p>Kuupäev: ${issueDate}</p>

<div class="meta">
  <div class="seller">
    <strong>Müüja:</strong><br>
    SanSan OÜ<br>
    Reg. nr: [REG_NUMBER]<br>
    KMKR: [VAT_NUMBER]<br>
    [ADDRESS]<br>
    tellimused@sansan.ee<br>
    Tel: +372 6 406 405
  </div>
  <div class="buyer">
    <strong>Ostja:</strong><br>
    ${order.customer.first_name} ${order.customer.last_name}<br>
    ${order.shipping_address?.address_1 || ""}<br>
    ${order.shipping_address?.postal_code || ""} ${order.shipping_address?.city || ""}<br>
    ${order.customer.email}
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>Nimetus</th>
      <th style="text-align:center">Kogus</th>
      <th style="text-align:right">Hind km-ta (€)</th>
      <th style="text-align:right">Summa km-ta (€)</th>
    </tr>
  </thead>
  <tbody>${itemRows}</tbody>
</table>

<table class="totals">
  <tr><td>Kokku km-ta:</td><td>${fmt(subtotalExclVat)} €</td></tr>
  <tr><td>Käibemaks 24%:</td><td>${fmt(vatAmount)} €</td></tr>
  <tr class="grand"><td><strong>Kokku km-ga:</strong></td><td><strong>${fmt(subtotal)} €</strong></td></tr>
</table>
</body>
</html>`
  }

  private buildEmailWrapper(invoiceNumber: string, firstName: string): string {
    return `<p>Tere ${firstName},</p>
<p>Täname ostu eest! Lisatud on arve <strong>${invoiceNumber}</strong>.</p>
<p>Küsimuste korral kirjutage <a href="mailto:tellimused@sansan.ee">tellimused@sansan.ee</a> või helistage <strong>+372 6 406 405</strong>.</p>
<p>Lugupidamisega,<br><strong>SanSan OÜ meeskond</strong></p>`
  }
}

function fmt(cents: number): string {
  return (cents / 100).toFixed(2)
}
