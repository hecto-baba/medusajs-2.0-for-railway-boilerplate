import type { CreateCampaignDTO } from "@medusajs/framework/types"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  createCampaignsWorkflow,
  createRemoteLinkStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import { MARKETPLACE_MODULE } from "../modules/marketplace"

export type CreateVendorCampaignWorkflowInput = {
  vendor_admin_id: string
  campaign: CreateCampaignDTO
}

/**
 * Creates a campaign and links it to the vendor behind the calling admin.
 *
 * Mirrors create-vendor-promotion.ts. The link step is the whole point - a
 * campaign created without it exists and is visible in the Medusa admin, but
 * is invisible to its own vendor forever, and (unlike promotions) there is no
 * other route that could ever attach it to them after the fact.
 */
export const createVendorCampaignWorkflow = createWorkflow(
  "create-vendor-campaign",
  (input: CreateVendorCampaignWorkflowInput) => {
    const campaignData = transform({ input }, (data) => ({
      campaignsData: [data.input.campaign],
    }))

    const createdCampaigns = createCampaignsWorkflow.runAsStep({
      input: campaignData,
    })

    const { data: vendorAdmins } = useQueryGraphStep({
      entity: "vendor_admin",
      fields: ["vendor.id"],
      filters: { id: input.vendor_admin_id },
    }).config({ name: "retrieve-vendor-admins" })

    const linksToCreate = transform(
      { createdCampaigns, vendorAdmins },
      (data) =>
        data.createdCampaigns.map((campaign) => ({
          [MARKETPLACE_MODULE]: {
            vendor_id: data.vendorAdmins[0].vendor.id,
          },
          [Modules.PROMOTION]: {
            campaign_id: campaign.id,
          },
        }))
    )

    createRemoteLinkStep(linksToCreate)

    const { data: campaigns } = useQueryGraphStep({
      entity: "campaign",
      fields: ["*", "budget.*"],
      filters: { id: createdCampaigns[0].id },
    }).config({ name: "retrieve-campaigns" })

    return new WorkflowResponse({ campaign: campaigns[0] })
  }
)
