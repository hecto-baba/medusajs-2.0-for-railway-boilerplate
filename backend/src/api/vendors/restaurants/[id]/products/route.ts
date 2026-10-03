import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createRestaurantProductsWorkflow } from "../../../../../workflows/restaurant/workflows/create-restaurant-products"
import { MARKETPLACE_MODULE } from "../../../../../modules/marketplace"
import { assertVendorOwnsRestaurant } from "../route"
import { getVendorId } from "../../../shared/vendor-scope"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await assertVendorOwnsRestaurant(req, req.params.id)
  const vendorId = await getVendorId(req)
  const remoteLink = req.scope.resolve(ContainerRegistrationKeys.REMOTE_LINK)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const body = (req.body || {}) as any
  let products = body.products || [body]

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

  // Link each created food product to the vendor
  if (Array.isArray(restaurantProducts) && vendorId) {
    for (const prod of restaurantProducts) {
      if (prod?.id) {
        await remoteLink.create([
          {
            [MARKETPLACE_MODULE]: { vendor_id: vendorId },
            [Modules.PRODUCT]: { product_id: prod.id },
          },
        ]).catch(() => {})
      }
    }
  }

  return res.status(201).json({ restaurant_products: restaurantProducts })
}
