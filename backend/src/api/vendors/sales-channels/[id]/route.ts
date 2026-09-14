import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  updateSalesChannelsWorkflow,
  deleteSalesChannelsWorkflow,
} from "@medusajs/medusa/core-flows"

export const UpdateVendorSalesChannelSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  is_disabled: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const channelId = req.params.id

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

  const { data: channels } = await query.graph({
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
      "products.title",
      "products.handle",
      "products.thumbnail",
      "products.status",
      "products.variants.id",
      "products.variants.title",
    ],
    filters: { id: channelId },
  })

  if (!channels?.length) {
    res.status(404).json({ message: "Sales channel not found." })
    return
  }

  const channel = channels[0]
  const scopedProducts = (channel.products || []).filter((p: any) =>
    vendorProductIds.has(p.id)
  )

  res.json({
    sales_channel: {
      ...channel,
      products: scopedProducts,
      products_count: scopedProducts.length,
    },
  })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof UpdateVendorSalesChannelSchema>>,
  res: MedusaResponse
) => {
  const channelId = req.params.id

  const { result } = await updateSalesChannelsWorkflow(req.scope).run({
    input: {
      selector: { id: channelId },
      update: req.validatedBody as any,
    },
  })

  res.json({ sales_channel: result[0] })
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const channelId = req.params.id

  await deleteSalesChannelsWorkflow(req.scope).run({
    input: { ids: [channelId] },
  })

  res.json({ id: channelId, object: "sales_channel", deleted: true })
}
