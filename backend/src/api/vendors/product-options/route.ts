import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { createVendorProductOptionWorkflow } from "../../../workflows/create-vendor-product-option"
import { assertOwnership } from "../products/helpers"
import { getVendorOptionIds } from "./helpers"

export const GetVendorProductOptionsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  q: z.string().optional(),
  product_id: z.string().optional(),
  is_exclusive: z.preprocess((val) => {
    if (typeof val === "string") {
      if (val === "true") return true
      if (val === "false") return false
    }
    return val
  }, z.boolean().optional()),
  created_at: z.any().optional(),
  updated_at: z.any().optional(),
  created_at_gte: z.string().optional(),
  updated_at_gte: z.string().optional(),
  order: z.string().optional(),
})

export const CreateVendorProductOptionSchema = z.object({
  title: z.string().min(1),
  values: z.array(z.string()).optional(),
  product_id: z.string().optional(),
})

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof CreateVendorProductOptionSchema>>,
  res: MedusaResponse
) => {
  const { title, values = [], product_id } = req.validatedBody

  // An option can only be attached to one of the seller's own products.
  if (product_id) {
    await assertOwnership(req, product_id)
  }

  const { result } = await createVendorProductOptionWorkflow(req.scope).run({
    input: {
      vendor_admin_id: req.auth_context.actor_id,
      product_option: {
        title,
        values,
        ...(product_id ? { product_id } : {}),
      } as any,
    },
  })

  res.status(201).json({ product_option: result.product_option })
}

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const {
    limit,
    offset,
    q,
    product_id,
    is_exclusive,
    created_at,
    updated_at,
    created_at_gte,
    updated_at_gte,
    order,
  } = req.validatedQuery as unknown as z.infer<typeof GetVendorProductOptionsSchema>

  // Options linked to the seller plus options of the seller's own products.
  const allOptionIds = await getVendorOptionIds(req)

  if (!allOptionIds.length) {
    res.json({ product_options: [], count: 0, limit, offset })
    return
  }

  const parseDateField = (raw: any, gteFallback?: string) => {
    if (gteFallback) return { $gte: gteFallback }
    if (!raw) return undefined
    if (typeof raw === "string") return raw
    if (typeof raw === "object") {
      const result: Record<string, any> = {}
      for (const [k, v] of Object.entries(raw)) {
        if (v) result[k] = v
      }
      return Object.keys(result).length ? result : undefined
    }
    return undefined
  }

  const filters: Record<string, any> = {
    id: allOptionIds,
    ...(q ? { title: { $ilike: `%${q}%` } } : {}),
    ...(product_id ? { product_id } : {}),
  }

  if (is_exclusive !== undefined) {
    filters.is_exclusive = is_exclusive
  }

  const createdFilter = parseDateField(created_at, created_at_gte)
  if (createdFilter) {
    filters.created_at = createdFilter
  }

  const updatedFilter = parseDateField(updated_at, updated_at_gte)
  if (updatedFilter) {
    filters.updated_at = updatedFilter
  }

  const { data: options, metadata } = await query.graph({
    entity: "product_option",
    fields: [
      "id",
      "title",
      "is_exclusive",
      "product_id",
      "values.*",
      "product.id",
      "product.title",
      "created_at",
      "updated_at",
    ],
    filters,
    pagination: {
      skip: offset,
      take: limit,
      order: order
        ? { [order.replace(/^-/, "")]: order.startsWith("-") ? "DESC" : "ASC" }
        : { created_at: "DESC" },
    },
  })

  res.json({
    product_options: options,
    count: metadata?.count ?? options.length,
    limit,
    offset,
  })
}
