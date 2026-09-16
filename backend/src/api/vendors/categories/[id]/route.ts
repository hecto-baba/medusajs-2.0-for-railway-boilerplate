import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  updateProductCategoriesWorkflow,
  deleteProductCategoriesWorkflow,
} from "@medusajs/medusa/core-flows"

export const UpdateVendorCategorySchema = z.object({
  name: z.string().optional(),
  handle: z.string().optional(),
  description: z.string().optional(),
  is_active: z.boolean().optional(),
  is_internal: z.boolean().optional(),
  parent_category_id: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const categoryId = req.params.id

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["vendor.id", "vendor.products.id"],
    filters: { id: [req.auth_context.actor_id] },
  })

  const vendorProductIds = new Set<string>(
    (vendorAdmin?.vendor?.products || []).map((p: any) => p.id)
  )

  const { data: categories } = await query.graph({
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
      "category_children.handle",
      "products.id",
      "products.title",
      "products.handle",
      "products.thumbnail",
      "products.status",
      "products.variants.id",
      "products.variants.title",
      "created_at",
      "updated_at",
    ],
    filters: { id: categoryId },
  })

  if (!categories?.length) {
    res.status(404).json({ message: "Category not found." })
    return
  }

  const category = categories[0]
  const scopedProducts = (category.products || []).filter((p: any) =>
    vendorProductIds.has(p.id)
  )

  res.json({
    category: {
      ...category,
      products: scopedProducts,
      products_count: scopedProducts.length,
    },
  })
}

export const POST = async (
  _req: AuthenticatedMedusaRequest<z.infer<typeof UpdateVendorCategorySchema>>,
  res: MedusaResponse
) => {
  res.status(403).json({
    message:
      "Categories are managed centrally by the platform taxonomy (TrustClaw) and cannot be updated by vendors.",
  })
}

export const DELETE = async (
  _req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  res.status(403).json({
    message:
      "Categories are managed centrally by the platform taxonomy (TrustClaw) and cannot be deleted by vendors.",
  })
}
