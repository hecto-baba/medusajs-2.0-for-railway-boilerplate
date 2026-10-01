import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { createVendorCategoryWorkflow } from "../../../workflows/create-vendor-category"

export const GetVendorCategoriesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  q: z.string().optional(),
  parent_category_id: z.string().optional().nullable(),
  order: z.string().optional(),
})

export const CreateVendorCategorySchema = z.object({
  name: z.string().min(1),
  handle: z.string().optional(),
  description: z.string().optional(),
  is_active: z.boolean().default(true),
  is_internal: z.boolean().default(false),
  parent_category_id: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const POST = async (
  _req: AuthenticatedMedusaRequest<z.infer<typeof CreateVendorCategorySchema>>,
  res: MedusaResponse
) => {
  res.status(403).json({
    message:
      "Categories are managed centrally by the platform taxonomy (TrustClaw) and cannot be created by vendors.",
  })
}

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { limit, offset, q, parent_category_id, order } =
    req.validatedQuery as unknown as z.infer<typeof GetVendorCategoriesSchema>

  // Get vendor's own categories and products
  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: [
      "vendor.id",
      "vendor.categories.id",
      "vendor.products.id",
      "vendor.products.categories.id",
    ],
    filters: { id: [req.auth_context.actor_id] },
  })

  const vendorCategoryIds = new Set<string>(
    (vendorAdmin?.vendor?.categories || []).map((c: any) => c?.id).filter(Boolean)
  )

  // Also include categories that contain this vendor's products
  for (const prod of vendorAdmin?.vendor?.products || []) {
    for (const cat of prod.categories || []) {
      if (cat?.id) vendorCategoryIds.add(cat.id)
    }
  }

  // Also include all store categories so vendors can see the platform taxonomy hierarchy
  const { data: allCategories, metadata } = await query.graph({
    entity: "product_category",
    fields: [
      "id",
      "name",
      "handle",
      "description",
      "is_active",
      "is_internal",
      "rank",
      "parent_category_id",
      "parent_category.id",
      "parent_category.name",
      "category_children.id",
      "category_children.name",
      "products.id",
      "created_at",
      "updated_at",
    ],
    filters: {
      ...(q ? { name: { $ilike: `%${q}%` } } : {}),
      ...(parent_category_id !== undefined ? { parent_category_id } : {}),
    },
    pagination: {
      skip: offset,
      take: limit,
      order: order
        ? { [order.replace(/^-/, "")]: order.startsWith("-") ? "DESC" : "ASC" }
        : { rank: "ASC", name: "ASC" },
    },
  })

  const vendorProductIds = new Set(
    (vendorAdmin?.vendor?.products || []).map((p: any) => p.id)
  )

  const categoriesWithVendorStats = allCategories.map((cat: any) => {
    const matchingProducts = (cat.products || []).filter((p: any) =>
      vendorProductIds.has(p.id)
    )
    return {
      ...cat,
      products_count: matchingProducts.length,
      is_vendor_owned: vendorCategoryIds.has(cat.id),
    }
  })

  res.json({
    categories: categoriesWithVendorStats,
    count: metadata?.count ?? allCategories.length,
    limit,
    offset,
  })
}
