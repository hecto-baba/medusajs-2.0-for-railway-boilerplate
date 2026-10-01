import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { createVendorCollectionWorkflow } from "../../../workflows/create-vendor-collection"

export const GetVendorCollectionsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  q: z.string().optional(),
  created_at: z.any().optional(),
  updated_at: z.any().optional(),
  created_at_gte: z.string().optional(),
  updated_at_gte: z.string().optional(),
  order: z.string().optional(),
})

export const CreateVendorCollectionSchema = z.object({
  title: z.string().min(1),
  handle: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof CreateVendorCollectionSchema>>,
  res: MedusaResponse
) => {
  if (!req.auth_context?.actor_id) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  let vendorId: string | undefined

  try {
    const {
      data: [vendorAdmin],
    } = await query.graph({
      entity: "vendor_admin",
      fields: ["vendor.id"],
      filters: { id: [req.auth_context.actor_id] },
    })
    vendorId = vendorAdmin?.vendor?.id
  } catch {
    // fallback will be handled by workflow
  }

  const { result } = await createVendorCollectionWorkflow(req.scope).run({
    input: {
      vendor_id: vendorId,
      vendor_admin_id: req.auth_context.actor_id,
      collection: req.validatedBody,
    },
  })

  res.status(201).json({ collection: result.collection })
}

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  if (!req.auth_context?.actor_id) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const {
    limit,
    offset,
    q,
    created_at,
    updated_at,
    created_at_gte,
    updated_at_gte,
    order,
  } = req.validatedQuery as unknown as z.infer<typeof GetVendorCollectionsSchema>

  // Get vendor's own collections and products
  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: [
      "vendor.id",
      "vendor.collections.id",
      "vendor.products.id",
      "vendor.products.collection_id",
    ],
    filters: { id: [req.auth_context.actor_id] },
  })

  const vendorCollectionIds = new Set<string>(
    (vendorAdmin?.vendor?.collections || [])
      .map((c: any) => c?.id)
      .filter(Boolean)
  )

  // Also include collections that contain this vendor's products
  const productCollectionIds = (vendorAdmin?.vendor?.products || [])
    .map((p: any) => p?.collection_id)
    .filter(Boolean)

  productCollectionIds.forEach((id: string) => vendorCollectionIds.add(id))

  const allCollectionIds = Array.from(vendorCollectionIds)

  if (!allCollectionIds.length) {
    res.json({ collections: [], count: 0, limit, offset })
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
    id: allCollectionIds,
    ...(q ? { title: { $ilike: `%${q}%` } } : {}),
  }

  const createdFilter = parseDateField(created_at, created_at_gte)
  if (createdFilter) {
    filters.created_at = createdFilter
  }

  const updatedFilter = parseDateField(updated_at, updated_at_gte)
  if (updatedFilter) {
    filters.updated_at = updatedFilter
  }

  const { data: collections, metadata } = await query.graph({
    entity: "product_collection",
    fields: [
      "id",
      "title",
      "handle",
      "metadata",
      "created_at",
      "updated_at",
      "products.id",
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

  const vendorProductIds = new Set(
    (vendorAdmin?.vendor?.products || []).map((p: any) => p.id)
  )

  const collectionsWithCount = collections.map((col: any) => {
    const matchingProducts = (col.products || []).filter((p: any) =>
      vendorProductIds.has(p.id)
    )
    return {
      ...col,
      products_count: matchingProducts.length,
    }
  })

  res.json({
    collections: collectionsWithCount,
    count: metadata?.count ?? collections.length,
    limit,
    offset,
  })
}
