import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { batchImageVariantsWorkflow } from "@medusajs/medusa/core-flows"
import {
  assertImageIdsBelongToProduct,
  assertOwnership,
  assertVariantIdsBelongToProduct,
} from "../../../../../helpers"

/**
 * Associates one of the vendor's images with variants - the mirror of the
 * variant-side route, used when editing from the media section.
 *
 * The image comes from the URL and the variant ids from the body, so both are
 * verified against the product the vendor owns.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id, image_id } = req.params
  await assertOwnership(req, id)
  await assertImageIdsBelongToProduct(req, id, [image_id])

  const body = req.validatedBody as { add?: string[]; remove?: string[] }

  await assertVariantIdsBelongToProduct(req, id, [
    ...(body.add ?? []),
    ...(body.remove ?? []),
  ])

  const { result } = await batchImageVariantsWorkflow(req.scope).run({
    input: {
      image_id,
      add: body.add,
      remove: body.remove,
    },
  })

  res.status(200).json({ added: result.added, removed: result.removed })
}
