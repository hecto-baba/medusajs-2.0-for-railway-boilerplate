import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  updateProductTypesWorkflow,
  deleteProductTypesWorkflow,
} from "@medusajs/medusa/core-flows"

export const UpdateVendorProductTypeSchema = z.object({
  value: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const typeId = req.params.id

  const { data: types } = await query.graph({
    entity: "product_type",
    fields: ["id", "value", "metadata", "created_at", "updated_at"],
    filters: { id: typeId },
  })

  if (!types?.length) {
    res.status(404).json({ message: "Product type not found." })
    return
  }

  res.json({ product_type: types[0] })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof UpdateVendorProductTypeSchema>>,
  res: MedusaResponse
) => {
  const typeId = req.params.id

  const { result } = await updateProductTypesWorkflow(req.scope).run({
    input: {
      selector: { id: typeId },
      update: req.validatedBody as any,
    },
  })

  res.json({ product_type: result[0] })
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const typeId = req.params.id

  await deleteProductTypesWorkflow(req.scope).run({
    input: { ids: [typeId] },
  })

  res.json({ id: typeId, object: "product_type", deleted: true })
}
