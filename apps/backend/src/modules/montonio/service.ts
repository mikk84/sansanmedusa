import { AbstractPaymentProvider } from "@medusajs/framework/utils"
import { MedusaError } from "@medusajs/utils"
import * as jwt from "jsonwebtoken"

type MontonioOptions = {
  accessKey: string
  secretKey: string
  environment: "sandbox" | "production"
}

const API_URLS = {
  sandbox: "https://sandbox-stargate.montonio.com",
  production: "https://stargate.montonio.com",
}

/**
 * Montonio payment provider for Medusa v2.
 *
 * Montonio is the primary payment processor for SanSan OÜ. It supports:
 * - Estonian, Latvian, Lithuanian bank links
 * - Card payments
 * - Hire purchase (järelmaks) via Inbank, Esto, LHV
 *
 * Flow:
 *   initiatePayment → build JWT order → redirect to Montonio checkout
 *   Montonio redirects back → webhook confirms payment → capturePayment
 *
 * Docs: https://docs.montonio.com
 */
export class MontonioPaymentService extends AbstractPaymentProvider<MontonioOptions> {
  static identifier = "montonio"

  private options: MontonioOptions
  private apiUrl: string

  constructor(container: any, options: MontonioOptions) {
    super(container, options)
    this.options = options || ({} as MontonioOptions)
    this.apiUrl = API_URLS[this.options.environment] || API_URLS.sandbox
  }

  async initiatePayment(input: any) {
    const { amount, currency_code, context: paymentContext = {} } = input

    const orderToken = jwt.sign(
      {
        access_key: this.options.accessKey,
        merchant_reference: paymentContext.resource_id,
        grand_total: amount / 100,
        currency: currency_code.toUpperCase(),
        merchant_return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/payment/callback`,
        merchant_notification_url: `${process.env.MEDUSA_BACKEND_URL}/hooks/payment/montonio`,
        billing_address: paymentContext.billing_address,
        shipping_address: paymentContext.shipping_address,
        locale: "et",
        exp: Math.floor(Date.now() / 1000) + 600, // 10 minutes
      },
      this.options.secretKey,
      { algorithm: "HS256" }
    )

    const checkoutUrl = `${this.apiUrl}/api/orders?payment_token=${orderToken}`

    return {
      id: paymentContext.resource_id,
      data: { checkout_url: checkoutUrl, order_token: orderToken },
    }
  }

  async authorizePayment(input: any) {
    // Montonio confirms via webhook (see /hooks/payment/montonio)
    // By the time we reach here, the webhook has already verified the JWT
    return {
      status: "authorized" as const,
      data: input.data,
    }
  }

  async capturePayment(input: any) {
    // Montonio captures at checkout; no separate capture step needed
    return { data: { ...input.data, status: "captured" } }
  }

  async refundPayment(_input: any): Promise<any> {
    // Montonio refunds are manual via the Montonio merchant portal
    // TODO: implement Refund API when Montonio exposes it
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Montonio refunds must be processed manually via the Montonio merchant portal."
    )
  }

  async cancelPayment(input: any) {
    return { data: { ...input.data, status: "canceled" } }
  }

  async getPaymentStatus(input: any) {
    return { status: input.data?.status || "pending" }
  }

  async retrievePayment(input: any) {
    return { data: input.data }
  }

  async deletePayment(input: any) {
    return { data: input.data }
  }

  async updatePayment(input: any) {
    return { data: input.data }
  }

  /**
   * Map an incoming Montonio webhook to a Medusa payment action.
   * Called by the payment module when a webhook hits the provider.
   */
  async getWebhookActionAndData(payload: any): Promise<any> {
    try {
      const token = payload?.data?.payment_token || payload?.data?.order_token
      if (!token) return { action: "not_supported" }
      const decoded: any = this.verifyWebhookJwt(token)
      const isPaid = decoded?.payment_status === "PAID" || decoded?.status === "PAID"
      return {
        action: isPaid ? "authorized" : "not_supported",
        data: {
          session_id: decoded?.merchant_reference,
          amount: Number(decoded?.grand_total ?? 0),
        },
      }
    } catch {
      return { action: "failed" }
    }
  }

  /**
   * Verify an incoming Montonio webhook JWT.
   * Called from /api/hooks/payment/montonio route.
   */
  verifyWebhookJwt(token: string): any {
    return jwt.verify(token, this.options.secretKey)
  }
}
