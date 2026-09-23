import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createRestaurantProductsWorkflow } from "../../../../../workflows/restaurant/workflows/create-restaurant-products"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as any
  let products = body.products || [body]
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  let defaultSalesChannelId: string | undefined
  try {
    const { data: channels } = await query.graph({
      entity: "sales_channel",
      fields: ["id"],
      pagination: { take: 1 },
    })
    if (channels && channels.length > 0) {
      defaultSalesChannelId = channels[0].id
    }
  } catch {}

  let defaultShippingProfileId: string | undefined
  try {
    const { data: profiles } = await query.graph({
      entity: "shipping_profile",
      fields: ["id"],
      pagination: { take: 1 },
    })
    if (profiles && profiles.length > 0) {
      defaultShippingProfileId = profiles[0].id
    }
  } catch {}

  // Ensure each product has sales channel and shipping profile
  products = products.map((p: any) => ({
    ...p,
    shipping_profile_id: p.shipping_profile_id || defaultShippingProfileId,
    sales_channels: p.sales_channels || (defaultSalesChannelId ? [{ id: defaultSalesChannelId }] : undefined),
  }))

  const { result: restaurantProducts } = await createRestaurantProductsWorkflow(req.scope).run({
    input: {
      products: products as any[],
      restaurant_id: req.params.id,
    },
  })
  return res.status(200).json({ restaurant_products: restaurantProducts })
}
