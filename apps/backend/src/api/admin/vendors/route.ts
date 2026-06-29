import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { VENDOR_MODULE } from "../../../modules/vendor"
import { VendorModuleService } from "../../../modules/vendor/services/vendor-module-service"

// GET /admin/vendors — list all vendors
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const vendorService = req.scope.resolve<VendorModuleService>(VENDOR_MODULE)
  const vendors = await vendorService.listVendors(
    { is_active: true },
    { order: { name: "ASC" } }
  )
  res.json({ vendors })
}

// POST /admin/vendors — create a vendor
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const vendorService = req.scope.resolve<VendorModuleService>(VENDOR_MODULE)
  const vendor = await vendorService.createVendors(req.body as any)
  res.status(201).json({ vendor })
}
