import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"

/**
 * Returns the calling vendor admin and the store they belong to.
 *
 * Scoped through actor_id rather than any request input, for the same reason
 * the products route is: actor_id is derived from the verified token, so a
 * vendor cannot read another vendor's profile by passing a different id.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: [
      "id",
      "email",
      "first_name",
      "last_name",
      "vendor.id",
      "vendor.name",
      "vendor.handle",
      "vendor.logo",
    ],
    filters: { id: [req.auth_context.actor_id] },
  })

  // A token that authenticates but resolves no admin means the record was
  // deleted while the session was still live.
  if (!vendorAdmin) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No vendor admin found for the authenticated session."
    )
  }

  res.json({ vendor_admin: vendorAdmin })
}
