import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type { HttpTypes } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { createVendorProductWorkflow } from "../../../workflows/create-vendor-product"

export const GetVendorProductsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  q: z.string().optional(),
})

export const POST = async (
  req: AuthenticatedMedusaRequest<HttpTypes.AdminCreateProduct>,
  res: MedusaResponse
) => {
  const { result } = await createVendorProductWorkflow(req.scope).run({
    input: {
      vendor_admin_id: req.auth_context.actor_id,
      product: req.validatedBody,
    },
  })

  res.status(201).json({ product: result.product })
}

/**
 * Lists the calling vendor's products, paginated.
 *
 * Scoping runs through the admin rather than taking a vendor id from the
 * request: actor_id comes from the verified token, so an admin cannot read
 * another vendor's catalogue by passing a different id.
 *
 * Paging is applied to the product query rather than to the link traversal.
 * Reading vendor.products.* returns the whole catalogue as one array, so
 * slicing it in JS would still load every row to show twenty - and `count`
 * has to describe the whole matching set, not the page, or the table's
 * pagination would end after the first page.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { limit, offset, q } = req.validatedQuery as unknown as z.infer<
    typeof GetVendorProductsSchema
  >

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["vendor.products.id"],
    filters: { id: [req.auth_context.actor_id] },
  })

  const productIds =
    vendorAdmin?.vendor?.products?.map((product) => product?.id).filter(Boolean) ??
    []

  // An unfiltered product query would list the whole store, so a vendor with
  // an empty catalogue has to short-circuit rather than fall through.
  if (!productIds.length) {
    res.json({ products: [], count: 0, limit, offset })
    return
  }

  const { data: products, metadata } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "handle",
      "status",
      "thumbnail",
      "created_at",
      "updated_at",
      "variants.id",
    ],
    filters: {
      id: productIds,
      ...(q ? { title: { $ilike: `%${q}%` } } : {}),
    },
    pagination: {
      skip: offset,
      take: limit,
      order: { created_at: "DESC" },
    },
  })

  res.json({
    products,
    count: metadata?.count ?? products.length,
    limit,
    offset,
  })
}
