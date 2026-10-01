import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MARKETPLACE_MODULE } from "../../../../modules/marketplace"
import MarketplaceModuleService from "../../../../modules/marketplace/service"

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

    let vendor
    try {
      vendor = await service.createVendors(input)
    } catch (err: any) {
      if (err?.message?.includes("metadata") || err?.code === "42703") {
        try {
          const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
          if (pg) {
            if (typeof pg.raw === "function") {
              await pg.raw('ALTER TABLE IF EXISTS "vendor" ADD COLUMN IF NOT EXISTS "metadata" jsonb;')
            } else if (typeof pg.query === "function") {
              await pg.query('ALTER TABLE IF EXISTS "vendor" ADD COLUMN IF NOT EXISTS "metadata" jsonb;')
            }
          }
        } catch {}
        vendor = await service.createVendors(input)
      } else {
        throw err
      }
    }

    return new StepResponse(vendor, vendor.id)
  },
  async (vendorId, { container }) => {
    if (!vendorId) return

    const service: MarketplaceModuleService =
      container.resolve(MARKETPLACE_MODULE)

    await service.deleteVendors(vendorId)
  }
)
