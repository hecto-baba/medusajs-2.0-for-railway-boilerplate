import type { CreateStockLocationInput } from "@medusajs/framework/types"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  createStockLocationsWorkflow,
  createRemoteLinkStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import { MARKETPLACE_MODULE } from "../modules/marketplace"

export type CreateVendorStockLocationWorkflowInput = {
  vendor_id?: string
  vendor_admin_id?: string
  stock_location: CreateStockLocationInput
}

export const createVendorStockLocationWorkflow = createWorkflow(
  "create-vendor-stock-location",
  (input: CreateVendorStockLocationWorkflowInput) => {
    const locationData = transform({ input }, (data) => ({
      locations: [data.input.stock_location],
    }))

    const createdLocations = createStockLocationsWorkflow.runAsStep({
      input: locationData,
    })

    const { data: vendorAdmins } = useQueryGraphStep({
      entity: "vendor_admin",
      fields: ["vendor.id"],
      filters: { id: input.vendor_admin_id },
    }).config({ name: "retrieve-vendor-admins-for-stock-location" })

    const linksToCreate = transform(
      { input, createdLocations, vendorAdmins },
      (data) => {
        const vendorId =
          data.input.vendor_id || data.vendorAdmins?.[0]?.vendor?.id
        if (!vendorId) {
          throw new Error("Cannot link stock location: Authenticated vendor profile does not exist.")
        }
        return data.createdLocations.map((loc) => ({
          [MARKETPLACE_MODULE]: {
            vendor_id: vendorId,
          },
          [Modules.STOCK_LOCATION]: {
            stock_location_id: loc.id,
          },
        }))
      }
    )

    createRemoteLinkStep(linksToCreate)

    const { data: stockLocations } = useQueryGraphStep({
      entity: "stock_location",
      fields: [
        "id",
        "name",
        "metadata",
        "created_at",
        "updated_at",
        "address.*",
        "fulfillment_sets.*",
        "fulfillment_providers.*",
      ],
      filters: { id: createdLocations[0].id },
    }).config({ name: "retrieve-created-vendor-stock-location" })

    return new WorkflowResponse({ stock_location: stockLocations[0] })
  }
)
