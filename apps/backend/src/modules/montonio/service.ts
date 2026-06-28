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
    this.options = options
    this.apiUrl = API_URLS[options.environment] || API_URLS.sandbox
  }

  async initiatePayment(context: any) {
    const { amount, currency_code, context: paymentContext } = context

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

  async authorizePayment(paymentSessionData: any, context: any) {
    // Montonio confirms via webhook (see /hooks/payment/montonio)
    // By the time we reach here, the webhook has already verified the JWT
    return {
      status: "authorized" as const,
      data: paymentSessionData,
    }
  }

  async capturePayment(paymentSessionData: any) {
    // Montonio captures at checkout; no separate capture step needed
    return { ...paymentSessionData, status: "captured" }
  }

  async refundPayment(paymentSessionData: any, refundAmount: number) {
    // Montonio refunds are manual via the Montonio merchant portal
    // TODO: implement Refund API when Montonio exposes it
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Montonio refunds must be processed manually via the Montonio merchant portal."
    )
  }

  async cancelPayment(paymentSessionData: any) {
    return { ...paymentSessionData, status: "canceled" }
  }

  async getPaymentStatus(paymentSessionData: any) {
    return paymentSessionData.status || "pending"
  }

  async retrievePayment(paymentSessionData: any) {
    return paymentSessionData
  }

  async deletePayment(paymentSessionData: any) {
    return paymentSessionData
  }

  async updatePayment(context: any) {
    return { id: context.id, data: context.data }
  }

  /**
   * Verify an incoming Montonio webhook JWT.
   * Called from /api/hooks/payment/montonio route.
   */
  verifyWebhookJwt(token: string): any {
    return jwt.verify(token, this.options.secretKey)
  }
}
