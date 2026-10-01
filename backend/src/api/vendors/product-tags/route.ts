import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { createVendorProductTagWorkflow } from "../../../workflows/create-vendor-product-tag"
import { getVisibleIds, ScopedEntity } from "../shared/platform-scope"

const PRODUCT_TAGS: ScopedEntity = {
  linkField: "product_tags",
  entity: "product_tag",
}

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

  // Own tags plus shared platform tags. Never another seller's.
  const { owned, platform } = await getVisibleIds(req, PRODUCT_TAGS)
  const visibleIds = [...owned, ...platform]

  // An empty id list means "no constraint" downstream, so answer directly.
  if (!visibleIds.length) {
    res.json({ product_tags: [], count: 0, limit, offset })
    return
  }

  const { data: tags, metadata } = await query.graph({
    entity: "product_tag",
    fields: ["id", "value", "metadata", "created_at", "updated_at"],
    filters: {
      id: visibleIds,
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
