import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type {
  CreateProductVariantWorkflowInputDTO,
  UpdateProductVariantWorkflowInputDTO,
} from "@medusajs/framework/types"
import { batchProductVariantsWorkflow } from "@medusajs/medusa/core-flows"
import {
  assertOwnership,
  assertVariantIdsBelongToProduct,
} from "../../../helpers"

/**
 * Creates, updates and deletes variants of one product in a single call.
 * Backs the "save the whole variant grid" action in the panel.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  await assertOwnership(req, id)

  const body = req.validatedBody as {
    create?: Record<string, any>[]
    update?: Record<string, any>[]
    delete?: string[]
  }

  // update and delete carry variant ids in the body, so each is verified to
  // belong to this product before the workflow runs.
  await assertVariantIdsBelongToProduct(req, id, [
    ...(body.update?.map((variant) => variant.id as string) ?? []),
    ...(body.delete ?? []),
  ])

  // product_id is forced to the verified URL id on both arms, so a body that
  // names a different product cannot redirect the write.
  const { result } = await batchProductVariantsWorkflow(req.scope).run({
    input: {
      create: body.create?.map((variant) => ({
        ...variant,
        product_id: id,
      })) as CreateProductVariantWorkflowInputDTO[] | undefined,
      update: body.update?.map((variant) => ({
        ...variant,
        product_id: id,
      })) as UpdateProductVariantWorkflowInputDTO[] | undefined,
      delete: body.delete,
    },
  })

  res.status(200).json({
    created: result.created,
    updated: result.updated,
    deleted: result.deleted,
  })
}
