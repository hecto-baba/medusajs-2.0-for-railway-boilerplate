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
import { assertVendorCanSee, getVisibleIds, ScopedEntity } from "../../shared/platform-scope"
import { assertVendorOwns } from "../../shared/vendor-scope"

const PRODUCT_TAGS: ScopedEntity = {
  linkField: "product_tags",
  entity: "product_tag",
}

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

  // Own or shared platform tag; another seller's tag is a 404.
  await assertVendorCanSee(req, PRODUCT_TAGS, tagId, "Product tag not found.")

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

  await assertVendorOwns(req, "product_tags", tagId, "Product tag not found.")

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

  await assertVendorOwns(req, "product_tags", tagId, "Product tag not found.")

  await deleteProductTagsWorkflow(req.scope).run({
    input: { ids: [tagId] },
  })

  res.json({ id: tagId, object: "product_tag", deleted: true })
}
