import { Module } from "@medusajs/framework/utils"
import { MontonioPaymentService } from "./service"

export const MONTONIO_MODULE = "montonio"

export default Module(MONTONIO_MODULE, {
  service: MontonioPaymentService,
})
