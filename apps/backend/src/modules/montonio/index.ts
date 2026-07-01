import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import { MontonioPaymentService } from "./service"

export const MONTONIO_MODULE = "montonio"

/**
 * Registered as a **payment provider** under Medusa's payment module (not a
 * standalone module) — that is how a custom `AbstractPaymentProvider` becomes
 * selectable at checkout. The resulting provider id is `pp_montonio_montonio`.
 * Configured in medusa-config.js under the `@medusajs/medusa/payment` providers.
 */
export default ModuleProvider(Modules.PAYMENT, {
  services: [MontonioPaymentService],
})
