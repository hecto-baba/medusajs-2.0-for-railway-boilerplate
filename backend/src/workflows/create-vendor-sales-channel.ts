import type { CreateSalesChannelDTO } from "@medusajs/framework/types"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  createSalesChannelsWorkflow,
  createRemoteLinkStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import { MARKETPLACE_MODULE } from "../modules/marketplace"

export type CreateVendorSalesChannelWorkflowInput = {
  vendor_id?: string
  vendor_admin_id?: string
  sales_channel: CreateSalesChannelDTO
}

export const createVendorSalesChannelWorkflow = createWorkflow(
  "create-vendor-sales-channel",
  (input: CreateVendorSalesChannelWorkflowInput) => {
    const channelData = transform({ input }, (data) => ({
      salesChannelsData: [data.input.sales_channel],
    }))

    const createdChannels = createSalesChannelsWorkflow.runAsStep({
      input: channelData,
    })

    const { data: vendorAdmins } = useQueryGraphStep({
      entity: "vendor_admin",
      fields: ["vendor.id"],
      filters: { id: input.vendor_admin_id },
    }).config({ name: "retrieve-vendor-admins-for-sales-channel" })

    const linksToCreate = transform(
      { input, createdChannels, vendorAdmins },
      (data) => {
        const vendorId =
          data.input.vendor_id || data.vendorAdmins?.[0]?.vendor?.id
        if (!vendorId) {
          throw new Error("Cannot link sales channel: Authenticated vendor profile does not exist.")
        }
        return data.createdChannels.map((sc) => ({
          [MARKETPLACE_MODULE]: {
            vendor_id: vendorId,
          },
          [Modules.SALES_CHANNEL]: {
            sales_channel_id: sc.id,
          },
        }))
      }
    )

    createRemoteLinkStep(linksToCreate)

    const { data: salesChannels } = useQueryGraphStep({
      entity: "sales_channel",
      fields: ["id", "name", "description", "is_disabled", "metadata", "created_at", "updated_at"],
      filters: { id: createdChannels[0].id },
    }).config({ name: "retrieve-created-vendor-sales-channel" })

    return new WorkflowResponse({ sales_channel: salesChannels[0] })
  }
)
