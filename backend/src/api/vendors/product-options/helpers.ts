import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"

/**
 * Ids of every product option the calling seller owns.
 *
 * An option is the seller's when it is linked to them directly (options created
 * on their own) OR when it belongs to one of their products (options created
 * together with a product). Returns an empty array when they own none; callers
 * must treat that as "match nothing", never as "no filter".
 */
export const getVendorOptionIds = async (
  req: AuthenticatedMedusaRequest
): Promise<string[]> => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: [
      "vendor.id",
      "vendor.product_options.id",
      "vendor.products.id",
      "vendor.products.options.id",
    ],
    filters: { id: [req.auth_context.actor_id] },
  })

  const ids = new Set<string>(
    (vendorAdmin?.vendor?.product_options || [])
      .map((option: any) => option?.id)
      .filter(Boolean)
  )

  for (const product of vendorAdmin?.vendor?.products || []) {
    for (const option of product.options || []) {
      if (option?.id) {
        ids.add(option.id)
      }
    }
  }

  return Array.from(ids)
}

/** Confirms the option belongs to the calling seller; 404 otherwise. */
export const assertVendorOwnsOption = async (
  req: AuthenticatedMedusaRequest,
  optionId: string
): Promise<void> => {
  const owned = await getVendorOptionIds(req)

  if (!owned.includes(optionId)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Product option not found.")
  }
}
