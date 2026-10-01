import type { CreateStockLocationInput } from "@medusajs/framework/types"
import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  createLocationFulfillmentSetWorkflow,
  createStockLocationsWorkflow,
  createRemoteLinkStep,
  createServiceZonesWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import { MARKETPLACE_MODULE } from "../modules/marketplace"

// The manual provider ships with Medusa; sellers ship and mark parcels by hand.
const DEFAULT_FULFILLMENT_PROVIDER_ID = "manual_manual"

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

    // A location with no fulfilment set, service zone, provider or sales channel
    // cannot serve shipping options or take reservations, so every new seller
    // location gets the full set. All of it hangs off this one seller-owned location.
    createLocationFulfillmentSetWorkflow.runAsStep({
      input: transform({ createdLocations, input }, (data) => ({
        location_id: data.createdLocations[0].id,
        fulfillment_set_data: {
          name: `${data.input.stock_location.name} shipping`,
          type: "shipping",
        },
      })),
    })

    const { data: provisionedLocations } = useQueryGraphStep({
      entity: "stock_location",
      fields: ["id", "fulfillment_sets.id"],
      filters: { id: createdLocations[0].id },
    }).config({ name: "retrieve-fulfillment-set-for-vendor-stock-location" })

    const serviceZoneInput = transform(
      { provisionedLocations, input },
      (data) => {
        const address = data.input.stock_location.address
        const countryCode = typeof address === "object" ? address?.country_code : undefined
        const fulfillmentSetId = (data.provisionedLocations as any)?.[0]?.fulfillment_sets?.[0]?.id
        if (!countryCode || !fulfillmentSetId) {
          return null
        }
        return {
          data: [
            {
              name: `${data.input.stock_location.name} zone`,
              fulfillment_set_id: fulfillmentSetId,
              geo_zones: [
                { type: "country" as const, country_code: countryCode.toLowerCase() },
              ],
            },
          ],
        }
      }
    )

    // Without an address country there is nothing to build a zone from.
    when({ serviceZoneInput }, ({ serviceZoneInput }) => !!serviceZoneInput).then(() => {
      createServiceZonesWorkflow.runAsStep({
        input: serviceZoneInput as any,
      })
    })

    createRemoteLinkStep(
      transform({ createdLocations }, (data) => [
        {
          [Modules.STOCK_LOCATION]: { stock_location_id: data.createdLocations[0].id },
          [Modules.FULFILLMENT]: { fulfillment_provider_id: DEFAULT_FULFILLMENT_PROVIDER_ID },
        },
      ])
    ).config({ name: "link-vendor-stock-location-fulfillment-provider" })

    const { data: stores } = useQueryGraphStep({
      entity: "store",
      fields: ["default_sales_channel_id"],
    }).config({ name: "retrieve-store-for-vendor-stock-location" })

    when({ stores }, ({ stores }) => !!(stores as any)?.[0]?.default_sales_channel_id).then(() => {
      linkSalesChannelsToStockLocationWorkflow.runAsStep({
        input: transform({ createdLocations, stores }, (data) => ({
          id: data.createdLocations[0].id,
          add: [(data.stores as any)[0].default_sales_channel_id],
        })),
      })
    })

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
