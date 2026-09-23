import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  updateProductTagsWorkflow,
  deleteProductTagsWorkflow,
} from "@medusajs/medusa/core-flows"

export const UpdateVendorProductTagSchema = z.object({
  value: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const tagId = req.params.id

  const { data: tags } = await query.graph({
    entity: "product_tag",
    fields: ["id", "value", "metadata", "created_at", "updated_at"],
    filters: { id: tagId },
  })

  if (!tags?.length) {
    res.status(404).json({ message: "Product tag not found." })
    return
  }

  res.json({ product_tag: tags[0] })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof UpdateVendorProductTagSchema>>,
  res: MedusaResponse
) => {
  const tagId = req.params.id

  const { result } = await updateProductTagsWorkflow(req.scope).run({
    input: {
      selector: { id: tagId },
      update: req.validatedBody as any,
    },
  })

  res.json({ product_tag: result[0] })
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const tagId = req.params.id

  await deleteProductTagsWorkflow(req.scope).run({
    input: { ids: [tagId] },
  })

  res.json({ id: tagId, object: "product_tag", deleted: true })
}
