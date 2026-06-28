import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MONTONIO_MODULE } from "../../../../modules/montonio"

/**
 * POST /hooks/payment/montonio
 *
 * Montonio calls this URL when a payment is completed or fails.
 * The payload is a signed JWT — we verify the signature before acting.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const montonioService = req.scope.resolve(MONTONIO_MODULE)

  const { payment_token } = req.body as { payment_token?: string }
  if (!payment_token) {
    return res.status(400).json({ error: "Missing payment_token" })
  }

  let payload: any
  try {
    payload = montonioService.verifyWebhookJwt(payment_token)
  } catch {
    return res.status(401).json({ error: "Invalid payment token signature" })
  }

  if (payload.payment_status !== "paid") {
    return res.status(200).json({ received: true, action: "none" })
  }

  // Update the corresponding Medusa payment session
  const paymentModule = req.scope.resolve("payment")
  await paymentModule.authorizePaymentSession(payload.merchant_reference, {})

  res.status(200).json({ received: true })
}
