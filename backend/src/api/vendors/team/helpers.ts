import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { getVendorId } from "../shared/vendor-scope"

/**
 * Confirms `memberId` is a team member of the calling seller.
 *
 * Team membership is a direct relation (vendor_admin -> vendor), not a link
 * row, so ownership is "the member's vendor is the caller's vendor". Answers
 * 404, never 403, so another seller's member is indistinguishable from one
 * that does not exist.
 */
export const assertVendorOwnsTeamMember = async (
  req: AuthenticatedMedusaRequest,
  memberId: string
): Promise<void> => {
  const vendorId = await getVendorId(req)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [member],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["id", "vendor.id"],
    filters: { id: [memberId] },
  })

  if (!member || member.vendor?.id !== vendorId) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Team member not found.")
  }
}
