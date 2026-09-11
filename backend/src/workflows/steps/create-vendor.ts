import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MARKETPLACE_MODULE } from "../../modules/marketplace"
import MarketplaceModuleService from "../../modules/marketplace/service"

export type CreateVendorStepInput = {
  name: string
  handle?: string
  logo?: string
}

export const createVendorStep = createStep(
  "create-vendor",
  async (input: CreateVendorStepInput, { container }) => {
    const service: MarketplaceModuleService =
      container.resolve(MARKETPLACE_MODULE)

    const vendor = await service.createVendors(input)

    return new StepResponse(vendor, vendor.id)
  },
  async (vendorId, { container }) => {
    if (!vendorId) return

    const service: MarketplaceModuleService =
      container.resolve(MARKETPLACE_MODULE)

    await service.deleteVendors([vendorId])
  }
)
