import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createAndLinkProductOptionsToProductWorkflow } from "@medusajs/medusa/core-flows"
import { assertOwnership, VENDOR_PRODUCT_DETAIL_FIELDS } from "../../../helpers"

/**
 * Creates, updates and deletes a product's options in one call.
 *
 * Mirrors /admin/products/:id/options/batch: the core workflow handles the
 * three-way diff, including regenerating the option values that variants
 * reference. Splitting this into separate calls would let a product sit with
 * options and variants out of step between requests.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertOwnership(req, id)

  await createAndLinkProductOptionsToProductWorkflow(req.scope).run({
    input: {
      product_id: id,
      ...(req.validatedBody as object),
    },
  })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [product],
  } = await query.graph({
    entity: "product",
    filters: { id },
    fields: VENDOR_PRODUCT_DETAIL_FIELDS,
  })

  res.status(200).json({ product })
}
