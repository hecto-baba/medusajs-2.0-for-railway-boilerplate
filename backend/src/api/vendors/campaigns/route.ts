import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type { HttpTypes } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { createVendorCampaignWorkflow } from "../../../workflows/create-vendor-campaign"
import { VENDOR_CAMPAIGN_FIELDS } from "./helpers"

export const GetVendorCampaignsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  q: z.string().optional(),
  order: z.string().optional(),
})

export const POST = async (
  req: AuthenticatedMedusaRequest<HttpTypes.AdminCreateCampaign>,
  res: MedusaResponse
) => {
  const { result } = await createVendorCampaignWorkflow(req.scope).run({
    input: {
      vendor_admin_id: req.auth_context.actor_id,
      campaign: req.validatedBody as any,
    },
  })

  res.status(201).json({ campaign: result.campaign })
}

/**
 * Lists the calling vendor's own campaigns.
 *
 * A vendor only ever owns a campaign it created through this feature (see
 * create-vendor-campaign.ts's comment), so this list can never include the
 * platform's or another vendor's campaigns - there is no separate "browse all
 * campaigns" route the way /vendors/taxonomy exists for shared taxonomy,
 * because campaigns are not shared platform-wide shelving the way collections
 * or tags are.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { limit, offset, q, order } = req.validatedQuery as unknown as z.infer<
    typeof GetVendorCampaignsSchema
  >

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["vendor.campaigns.id"],
    filters: { id: [req.auth_context.actor_id] },
  })

  const campaignIds =
    vendorAdmin?.vendor?.campaigns
      ?.map((campaign) => campaign?.id)
      .filter(Boolean) ?? []

  if (!campaignIds.length) {
    res.json({ campaigns: [], count: 0, limit, offset })
    return
  }

  const desc = order?.startsWith("-") ?? false
  const orderField = order ? (desc ? order.slice(1) : order) : undefined
  const allowedOrder =
    orderField === "name" || orderField === "created_at" ? orderField : undefined

  const { data: campaigns, metadata } = await query.graph({
    entity: "campaign",
    fields: VENDOR_CAMPAIGN_FIELDS,
    filters: {
      id: campaignIds,
      ...(q ? { name: { $ilike: `%${q}%` } } : {}),
    },
    pagination: {
      skip: offset,
      take: limit,
      order: allowedOrder
        ? { [allowedOrder]: desc ? "DESC" : "ASC" }
        : { created_at: "DESC" },
    },
  })

  res.json({
    campaigns,
    count: metadata?.count ?? campaigns.length,
    limit,
    offset,
  })
}
