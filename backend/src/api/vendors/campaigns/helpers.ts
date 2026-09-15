import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"

/**
 * Confirms the campaign behind a URL id belongs to the calling vendor.
 *
 * Mirrors promotions/helpers.ts assertOwnership. Deliberately a 404 rather
 * than a 403 - see that file for why.
 */
export const assertOwnership = async (
  req: AuthenticatedMedusaRequest,
  campaignId: string
): Promise<void> => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["vendor.campaigns.id"],
    filters: { id: [req.auth_context.actor_id] },
  })

  const owns = vendorAdmin?.vendor?.campaigns?.some(
    (campaign) => campaign?.id === campaignId
  )

  if (!owns) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Campaign not found.")
  }
}

/** Fields returned for a campaign in the vendor panel. */
export const VENDOR_CAMPAIGN_FIELDS = [
  "id",
  "name",
  "description",
  "campaign_identifier",
  "starts_at",
  "ends_at",
  "created_at",
  "updated_at",
  "budget.*",
  "promotions.*",
  "promotions.application_method.*",
]
