import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MARKETPLACE_MODULE } from "../../modules/marketplace"
import MarketplaceModuleService from "../../modules/marketplace/service"

export type CreateVendorAdminStepInput = {
  email: string
  first_name?: string
  last_name?: string
  vendor_id: string
}

export const createVendorAdminStep = createStep(
  "create-vendor-admin",
  async (input: CreateVendorAdminStepInput, { container }) => {
    const service: MarketplaceModuleService =
      container.resolve(MARKETPLACE_MODULE)

    const vendorAdmin = await service.createVendorAdmins(input)

    return new StepResponse(vendorAdmin, vendorAdmin.id)
  },
  async (vendorAdminId, { container }) => {
    if (!vendorAdminId) return

    const service: MarketplaceModuleService =
      container.resolve(MARKETPLACE_MODULE)

    await service.deleteVendorAdmins([vendorAdminId])
  }
)
