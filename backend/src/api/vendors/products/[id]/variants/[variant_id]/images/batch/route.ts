import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { batchVariantImagesWorkflow } from "@medusajs/medusa/core-flows"
import {
  assertImageIdsBelongToProduct,
  assertOwnership,
  assertVariantBelongsToProduct,
} from "../../../../../helpers"

/**
 * Associates images with one of the vendor's variants.
 *
 * Three ids are caller-controlled here - product, variant and the image ids in
 * the body - so all three are checked. Verifying only the product and variant
 * would let a vendor attach another vendor's image to their own variant.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id, variant_id } = req.params
  await assertOwnership(req, id)
  await assertVariantBelongsToProduct(req, id, variant_id)

  const body = req.validatedBody as { add?: string[]; remove?: string[] }

  await assertImageIdsBelongToProduct(req, id, [
    ...(body.add ?? []),
    ...(body.remove ?? []),
  ])

  const { result } = await batchVariantImagesWorkflow(req.scope).run({
    input: {
      variant_id,
      add: body.add,
      remove: body.remove,
    },
  })

  res.status(200).json({ added: result.added, removed: result.removed })
}
