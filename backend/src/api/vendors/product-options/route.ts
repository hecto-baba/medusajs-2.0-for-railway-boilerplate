import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { createVendorProductOptionWorkflow } from "../../../workflows/create-vendor-product-option"

export const GetVendorProductOptionsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  q: z.string().optional(),
  product_id: z.string().optional(),
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
  const { limit, offset, q, product_id, order } =
    req.validatedQuery as unknown as z.infer<typeof GetVendorProductOptionsSchema>

  // Get vendor's own options and products
  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: [
      "vendor.id",
      "vendor.product_options.id",
      "vendor.products.id",
      "vendor.products.options.id",
    ],
    filters: { id: [req.auth_context.actor_id] },
  })

  const vendorOptionIds = new Set<string>(
    (vendorAdmin?.vendor?.product_options || [])
      .map((o: any) => o?.id)
      .filter(Boolean)
  )

  for (const prod of vendorAdmin?.vendor?.products || []) {
    for (const opt of prod.options || []) {
      if (opt?.id) vendorOptionIds.add(opt.id)
    }
  }

  const allOptionIds = Array.from(vendorOptionIds)

  if (!allOptionIds.length) {
    res.json({ product_options: [], count: 0, limit, offset })
    return
  }

  const { data: options, metadata } = await query.graph({
    entity: "product_option",
    fields: [
      "id",
      "title",
      "product_id",
      "values.*",
      "product.id",
      "product.title",
      "created_at",
      "updated_at",
    ],
    filters: {
      id: allOptionIds,
      ...(q ? { title: { $ilike: `%${q}%` } } : {}),
      ...(product_id ? { product_id } : {}),
    },
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
