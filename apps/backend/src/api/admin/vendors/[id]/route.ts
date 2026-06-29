import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { VENDOR_MODULE } from "../../../../modules/vendor"
import { VendorModuleService } from "../../../../modules/vendor/services/vendor-module-service"

// GET /admin/vendors/:id
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const vendorService = req.scope.resolve<VendorModuleService>(VENDOR_MODULE)
  const vendor = await vendorService.retrieveVendor(req.params.id)
  res.json({ vendor })
}

// PUT /admin/vendors/:id
export async function PUT(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const vendorService = req.scope.resolve<VendorModuleService>(VENDOR_MODULE)
  const vendor = await vendorService.updateVendors({
    id: req.params.id,
    ...(req.body as any),
  })
  res.json({ vendor })
}

// DELETE /admin/vendors/:id  (soft-delete: sets is_active = false)
export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const vendorService = req.scope.resolve<VendorModuleService>(VENDOR_MODULE)
  await vendorService.updateVendors({ id: req.params.id, is_active: false })
  res.json({ deleted: true })
}
