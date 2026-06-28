import { Module } from "@medusajs/framework/utils"
import { VendorModuleService } from "./services/vendor-module-service"

export const VENDOR_MODULE = "vendor"

export default Module(VENDOR_MODULE, {
  service: VendorModuleService,
})
