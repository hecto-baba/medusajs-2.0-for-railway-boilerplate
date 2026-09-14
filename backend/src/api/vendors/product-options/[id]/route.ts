import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  updateProductOptionsWorkflow,
  deleteProductOptionsWorkflow,
} from "@medusajs/medusa/core-flows"

export const UpdateVendorProductOptionSchema = z.object({
  title: z.string().optional(),
  values: z.array(z.string()).optional(),
})

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const optionId = req.params.id

  const { data: options } = await query.graph({
    entity: "product_option",
    fields: [
      "id",
      "title",
      "product_id",
      "values.*",
      "product.id",
      "product.title",
      "product.thumbnail",
      "created_at",
      "updated_at",
    ],
    filters: { id: optionId },
  })

  if (!options?.length) {
    res.status(404).json({ message: "Product option not found." })
    return
  }

  res.json({ product_option: options[0] })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof UpdateVendorProductOptionSchema>>,
  res: MedusaResponse
) => {
  const optionId = req.params.id

  const { result } = await updateProductOptionsWorkflow(req.scope).run({
    input: {
      selector: { id: optionId },
      update: req.validatedBody as any,
    },
  })

  res.json({ product_option: result[0] })
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const optionId = req.params.id

  await deleteProductOptionsWorkflow(req.scope).run({
    input: { ids: [optionId] },
  })

  res.json({ id: optionId, object: "product_option", deleted: true })
}
