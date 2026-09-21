import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { createVendorProductTypeWorkflow } from "../../../workflows/create-vendor-product-type"

export const GetVendorProductTypesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  q: z.string().optional(),
  order: z.string().optional(),
  created_at_gte: z.string().optional(),
})

export const CreateVendorProductTypeSchema = z.object({
  value: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof CreateVendorProductTypeSchema>>,
  res: MedusaResponse
) => {
  const { result } = await createVendorProductTypeWorkflow(req.scope).run({
    input: {
      vendor_admin_id: req.auth_context.actor_id,
      product_type: req.validatedBody as any,
    },
  })

  res.status(201).json({ product_type: result.product_type })
}

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { limit, offset, q, order, created_at_gte } = req.validatedQuery as unknown as z.infer<
    typeof GetVendorProductTypesSchema
  >

  const filters: Record<string, any> = {}
  if (q) {
    filters.value = { $ilike: `%${q}%` }
  }
  if (created_at_gte) {
    filters.created_at = { $gte: new Date(created_at_gte) }
  }

  let orderConfig: Record<string, "ASC" | "DESC"> = { created_at: "ASC" }
  if (order) {
    const isDesc = order.startsWith("-")
    const field = isDesc ? order.slice(1) : order
    orderConfig = { [field]: isDesc ? "DESC" : "ASC" }
  }

  const { data: types, metadata } = await query.graph({
    entity: "product_type",
    fields: ["id", "value", "metadata", "created_at", "updated_at"],
    filters,
    pagination: {
      skip: offset,
      take: limit,
      order: orderConfig,
    },
  })

  res.json({
    product_types: types,
    count: metadata?.count ?? types.length,
    limit,
    offset,
  })
}
