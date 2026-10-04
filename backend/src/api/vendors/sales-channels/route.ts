import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { createVendorSalesChannelWorkflow } from "../../../workflows/create-vendor-sales-channel"
import { getVisibleIds, ScopedEntity } from "../shared/platform-scope"

const SALES_CHANNELS: ScopedEntity = {
  linkField: "sales_channels",
  entity: "sales_channel",
}

export const GetVendorSalesChannelsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  q: z.string().optional(),
  order: z.string().optional(),
  status: z.string().optional(),
  created_at_gte: z.string().optional(),
  updated_at_gte: z.string().optional(),
})

export const CreateVendorSalesChannelSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  is_disabled: z.boolean().default(false),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof CreateVendorSalesChannelSchema>>,
  res: MedusaResponse
) => {
  const { result } = await createVendorSalesChannelWorkflow(req.scope).run({
    input: {
      vendor_admin_id: req.auth_context.actor_id,
      sales_channel: req.validatedBody as any,
    },
  })

  res.status(201).json({ sales_channel: result.sales_channel })
}

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { limit, offset, q, order, status, created_at_gte, updated_at_gte } =
    req.validatedQuery as unknown as z.infer<typeof GetVendorSalesChannelsSchema>

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: [
      "vendor.id",
      "vendor.sales_channels.id",
      "vendor.products.id",
      "vendor.products.sales_channels.id",
    ],
    filters: { id: [req.auth_context.actor_id] },
  })

  const vendorChannelIds = new Set<string>(
    (vendorAdmin?.vendor?.sales_channels || []).map((sc: any) => sc?.id).filter(Boolean)
  )

  for (const prod of vendorAdmin?.vendor?.products || []) {
    for (const sc of prod.sales_channels || []) {
      if (sc?.id) vendorChannelIds.add(sc.id)
    }
  }

  // Own channels plus shared platform channels. Never another seller's.
  const { owned, platform } = await getVisibleIds(req, SALES_CHANNELS)
  const visibleIds = [...owned, ...platform]

  // An empty id list means "no constraint" downstream, so answer directly.
  if (!visibleIds.length) {
    res.json({ sales_channels: [], count: 0, limit, offset })
    return
  }

  const filters: Record<string, any> = { id: visibleIds }
  if (q) {
    filters.$or = [
      { name: { $ilike: `%${q}%` } },
      { description: { $ilike: `%${q}%` } },
    ]
  }
  if (status === "enabled" || status === "false") {
    filters.is_disabled = false
  } else if (status === "disabled" || status === "true") {
    filters.is_disabled = true
  }
  if (created_at_gte) {
    filters.created_at = { $gte: new Date(created_at_gte) }
  }
  if (updated_at_gte) {
    filters.updated_at = { $gte: new Date(updated_at_gte) }
  }

  let orderConfig: Record<string, "ASC" | "DESC"> = { created_at: "ASC" }
  if (order) {
    const isDesc = order.startsWith("-")
    const rawField = isDesc ? order.slice(1) : order
    const field = rawField === "status" ? "is_disabled" : rawField
    orderConfig = { [field]: isDesc ? "DESC" : "ASC" }
  }

  // Also query store channels
  const { data: allChannels, metadata } = await query.graph({
    entity: "sales_channel",
    fields: [
      "id",
      "name",
      "description",
      "is_disabled",
      "metadata",
      "created_at",
      "updated_at",
      "products.id",
    ],
    filters,
    pagination: {
      skip: offset,
      take: limit,
      order: orderConfig,
    },
  })

  const vendorProductIds = new Set(
    (vendorAdmin?.vendor?.products || []).map((p: any) => p.id)
  )

  // The store's default channel, so the product form can pre-select it the way
  // the admin does.
  const {
    data: [store],
  } = await query.graph({ entity: "store", fields: ["default_sales_channel_id"] })
  const defaultChannelId = store?.default_sales_channel_id

  const channelsWithStats = allChannels.map((sc: any) => {
    const matchingProducts = (sc.products || []).filter((p: any) =>
      vendorProductIds.has(p.id)
    )
    return {
      ...sc,
      products_count: matchingProducts.length,
      is_vendor_owned: vendorChannelIds.has(sc.id),
      is_default: sc.id === defaultChannelId,
    }
  })

  res.json({
    sales_channels: channelsWithStats,
    count: metadata?.count ?? allChannels.length,
    limit,
    offset,
  })
}
