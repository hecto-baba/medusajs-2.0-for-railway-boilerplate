import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { createVendorProductTagWorkflow } from "../../../workflows/create-vendor-product-tag"

export const GetVendorProductTagsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  q: z.string().optional(),
})

export const CreateVendorProductTagSchema = z.object({
  value: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof CreateVendorProductTagSchema>>,
  res: MedusaResponse
) => {
  const { result } = await createVendorProductTagWorkflow(req.scope).run({
    input: {
      vendor_admin_id: req.auth_context.actor_id,
      product_tag: req.validatedBody as any,
    },
  })

  res.status(201).json({ product_tag: result.product_tag })
}

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { limit, offset, q } = req.validatedQuery as unknown as z.infer<
    typeof GetVendorProductTagsSchema
  >

  const { data: tags, metadata } = await query.graph({
    entity: "product_tag",
    fields: ["id", "value", "metadata", "created_at", "updated_at"],
    filters: {
      ...(q ? { value: { $ilike: `%${q}%` } } : {}),
    },
    pagination: {
      skip: offset,
      take: limit,
      order: { created_at: "ASC" },
    },
  })

  res.json({
    product_tags: tags,
    count: metadata?.count ?? tags.length,
    limit,
    offset,
  })
}
