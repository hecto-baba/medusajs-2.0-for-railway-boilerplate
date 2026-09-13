import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { MARKETPLACE_MODULE } from "../../../modules/marketplace"
import type MarketplaceModuleService from "../../../modules/marketplace/service"

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

/**
 * Updates the calling vendor admin's own profile and their store's details.
 *
 * Scoped the same way GET is: the admin row and the vendor row are both reached
 * from req.auth_context.actor_id, never from an id in the body, so a vendor can
 * only ever write their own records.
 *
 * Email is deliberately not updatable here. It is the emailpass auth identity's
 * key as well as a column on vendor_admin, and changing only the latter would
 * leave a vendor unable to sign in with the address their profile now shows.
 */
export const PATCH = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const marketplace = req.scope.resolve<MarketplaceModuleService>(
    MARKETPLACE_MODULE
  )

  const {
    data: [existing],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["id", "vendor.id"],
    filters: { id: [req.auth_context.actor_id] },
  })

  if (!existing) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No vendor admin found for the authenticated session."
    )
  }

  const body = (req.validatedBody ?? req.body) as {
    first_name?: string | null
    last_name?: string | null
    name?: string
    logo?: string | null
  }

  // Each field is applied only when the client actually sent the key, so a
  // form that submits one section does not blank out the other's columns.
  const adminUpdate: Record<string, unknown> = {}
  if ("first_name" in body) {
    adminUpdate.first_name = body.first_name || null
  }
  if ("last_name" in body) {
    adminUpdate.last_name = body.last_name || null
  }

  if (Object.keys(adminUpdate).length) {
    await marketplace.updateVendorAdmins({ id: existing.id, ...adminUpdate })
  }

  const vendorUpdate: Record<string, unknown> = {}
  if ("name" in body) {
    const name = body.name?.trim()

    // name is non-nullable on the model, so an empty submission is rejected
    // rather than written through as a store with no name.
    if (!name) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Store name cannot be empty."
      )
    }

    vendorUpdate.name = name
  }
  if ("logo" in body) {
    vendorUpdate.logo = body.logo || null
  }

  if (Object.keys(vendorUpdate).length && existing.vendor?.id) {
    await marketplace.updateVendors({ id: existing.vendor.id, ...vendorUpdate })
  }

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
    filters: { id: [existing.id] },
  })

  res.json({ vendor_admin: vendorAdmin })
}
