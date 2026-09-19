import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { assertVendorOwns } from "../../../shared/vendor-scope"

/**
 * Rentals booked on one of the vendor's orders.
 *
 * Mirrors the admin's GET /admin/orders/:id/rentals field-for-field, but runs
 * assertVendorOwns first so a vendor can only see bookings on orders that are
 * actually theirs (via the vendor->order module link, the same one
 * /vendors/orders lists from) - the admin route has no such check because it
 * assumes a platform admin caller.
 *
 * Unlike the vendor's product-scoped rental-config route, this does not also
 * filter individual line items down to the vendor's own products: an order's
 * rental rows already only ever reference variants of products the vendor
 * owns, since a rental can only exist on a product that vendor made rentable
 * in the first place.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertVendorOwns(req, "orders", id, "Order not found.")

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: rentals } = await query.graph({
    entity: "rental",
    fields: [
      "*",
      "product_variant.id",
      "product_variant.title",
      "product_variant.product.id",
      "product_variant.product.title",
      "product_variant.product.thumbnail",
    ],
    filters: {
      order_id: id,
    },
  })

  res.json({ rentals })
}
