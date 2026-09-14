import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { getOrdersListWorkflow } from "@medusajs/medusa/core-flows"
import { createVendorDraftOrderWorkflow } from "../../../workflows/create-vendor-draft-order"

export const GetVendorDraftOrdersSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  q: z.string().optional(),
  order: z.string().optional(),
})

export const CreateVendorDraftOrderSchema = z.object({
  customer_id: z.string().optional(),
  email: z.string().email().optional(),
  currency_code: z.string().optional(),
  region_id: z.string().optional(),
  sales_channel_id: z.string().optional(),
  shipping_address: z
    .object({
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      address_1: z.string().optional(),
      city: z.string().optional(),
      postal_code: z.string().optional(),
      country_code: z.string().optional(),
      phone: z.string().optional(),
    })
    .optional(),
  billing_address: z
    .object({
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      address_1: z.string().optional(),
      city: z.string().optional(),
      postal_code: z.string().optional(),
      country_code: z.string().optional(),
      phone: z.string().optional(),
    })
    .optional(),
  items: z.array(
    z.object({
      variant_id: z.string().optional(),
      title: z.string().optional(),
      quantity: z.number().int().min(1),
      unit_price: z.number().min(0).optional(),
    })
  ),
  shipping_methods: z
    .array(
      z.object({
        name: z.string(),
        amount: z.number().min(0),
        shipping_option_id: z.string().optional(),
      })
    )
    .optional(),
  promo_codes: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof CreateVendorDraftOrderSchema>>,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const input = req.validatedBody

  // Default region / currency / sales channel if missing
  let currencyCode = input.currency_code
  let regionId = input.region_id
  let salesChannelId = input.sales_channel_id

  if (!currencyCode || !regionId) {
    const { data: regions } = await query.graph({
      entity: "region",
      fields: ["id", "currency_code"],
      pagination: { take: 1 },
    })
    if (regions?.length) {
      if (!regionId) regionId = regions[0].id
      if (!currencyCode) currencyCode = regions[0].currency_code
    }
  }

  if (!salesChannelId) {
    const { data: stores } = await query.graph({
      entity: "store",
      fields: ["default_sales_channel_id"],
    })
    if (stores?.length) {
      salesChannelId = stores[0].default_sales_channel_id
    }
  }

  const { result } = await createVendorDraftOrderWorkflow(req.scope).run({
    input: {
      vendor_admin_id: req.auth_context.actor_id,
      order: {
        ...input,
        currency_code: currencyCode || "eur",
        region_id: regionId,
        sales_channel_id: salesChannelId,
        status: "draft" as any,
        is_draft_order: true,
      } as any,
    },
  })

  res.status(201).json({ draft_order: result.draft_order })
}

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { limit, offset, q } = req.validatedQuery as unknown as z.infer<
    typeof GetVendorDraftOrdersSchema
  >

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["vendor.id", "vendor.products.id", "vendor.orders.*"],
    filters: { id: [req.auth_context.actor_id] },
  })

  if (!vendorAdmin?.vendor) {
    res.status(404).json({ message: "Vendor profile not found." })
    return
  }

  const allOrderIds = (vendorAdmin.vendor.orders || [])
    .map((o: any) => o?.id)
    .filter(Boolean)

  if (!allOrderIds.length) {
    res.json({ draft_orders: [], count: 0, limit, offset })
    return
  }

  // Query orders with is_draft_order: true
  const { result: rawOrders } = await getOrdersListWorkflow(req.scope).run({
    input: {
      fields: [
        "id",
        "display_id",
        "status",
        "is_draft_order",
        "created_at",
        "currency_code",
        "total",
        "subtotal",
        "shipping_total",
        "tax_total",
        "discount_total",
        "email",
        "customer.*",
        "items.*",
        "items.variant.*",
        "items.variant.product.*",
      ],
      variables: {
        filters: {
          id: allOrderIds,
          is_draft_order: true,
        },
      },
    },
  })

  const orderRows = Array.isArray(rawOrders)
    ? rawOrders
    : (rawOrders as any)?.rows || []

  // Filter for matching search query if provided
  let filtered = orderRows
  if (q) {
    const lower = q.toLowerCase()
    filtered = filtered.filter(
      (o: any) =>
        o.display_id?.toString().includes(lower) ||
        o.email?.toLowerCase().includes(lower) ||
        o.customer?.first_name?.toLowerCase().includes(lower) ||
        o.customer?.last_name?.toLowerCase().includes(lower)
    )
  }

  // Sort and slice for pagination
  const sorted = filtered.sort(
    (a: any, b: any) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  const count = sorted.length
  const paged = sorted.slice(offset, offset + limit)

  res.json({
    draft_orders: paged,
    count,
    limit,
    offset,
  })
}
