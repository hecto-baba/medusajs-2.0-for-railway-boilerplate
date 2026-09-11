import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type { HttpTypes } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createVendorProductWorkflow } from "../../../workflows/create-vendor-product"

export const POST = async (
  req: AuthenticatedMedusaRequest<HttpTypes.AdminCreateProduct>,
  res: MedusaResponse
) => {
  const { result } = await createVendorProductWorkflow(req.scope).run({
    input: {
      vendor_admin_id: req.auth_context.actor_id,
      product: req.validatedBody,
    },
  })

  res.status(201).json({ product: result.product })
}

/**
 * Lists the calling vendor's products.
 *
 * Scoping runs through the admin rather than taking a vendor id from the
 * request: actor_id comes from the verified token, so an admin cannot read
 * another vendor's catalogue by passing a different id.
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
    fields: ["vendor.products.*"],
    filters: { id: [req.auth_context.actor_id] },
  })

  res.json({ products: vendorAdmin?.vendor?.products ?? [] })
}
