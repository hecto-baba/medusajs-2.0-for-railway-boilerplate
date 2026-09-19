import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { assertVendorOwns } from "../shared/vendor-scope"

/**
 * Confirms a rental id belongs to one of the calling vendor's orders.
 *
 * A rental's own id carries no vendor field - like the product-rental-config
 * route, ownership is derived transitively, but here through the rental's
 * order_id rather than through a product_id, since these routes (status
 * update, deposit management) act on a specific booking rather than a
 * product's configuration. Resolves the rental's order_id first, then reuses
 * assertVendorOwns' existing order-ownership check rather than duplicating
 * it.
 *
 * Deliberately 404, not 403, matching every other ownership check in this
 * codebase: "exists but not yours" must be indistinguishable from "does not
 * exist".
 */
export const assertVendorOwnsRental = async (
  req: AuthenticatedMedusaRequest,
  rentalId: string
): Promise<void> => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: rentals } = await query.graph({
    entity: "rental",
    fields: ["id", "order_id"],
    filters: { id: rentalId },
  })

  const rental = rentals[0]

  if (!rental?.order_id) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Rental not found.")
  }

  await assertVendorOwns(req, "orders", rental.order_id, "Rental not found.")
}
