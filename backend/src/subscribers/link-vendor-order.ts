import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { MARKETPLACE_MODULE } from "../modules/marketplace"

export default async function linkVendorOrderHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)

  try {
    const {
      data: [order],
    } = await query.graph({
      entity: "order",
      fields: ["id", "items.product_id", "items.variant.product_id"],
      filters: { id: data.id },
    })

    if (!order || !order.items?.length) {
      return
    }

    const productIds = Array.from(
      new Set(
        order.items
          .map((item: any) => item.product_id || item.variant?.product_id)
          .filter((id: any) => typeof id === "string" && id.length > 0)
      )
    )

    if (!productIds.length) {
      return
    }

    const { data: vendors } = await query.graph({
      entity: "vendor",
      fields: ["id", "products.id", "orders.id"],
      filters: {
        products: { id: productIds },
      },
    })

    const matchingVendors = (vendors || []).filter((v: any) =>
      v.products?.some((p: any) => productIds.includes(p.id))
    )

    if (!matchingVendors.length) {
      return
    }

    const linksToCreate = matchingVendors
      .filter((vendor: any) => {
        const alreadyLinked = vendor.orders?.some((o: any) => o?.id === order.id)
        return !alreadyLinked
      })
      .map((vendor: any) => ({
        [MARKETPLACE_MODULE]: {
          vendor_id: vendor.id,
        },
        [Modules.ORDER]: {
          order_id: order.id,
        },
      }))

    if (linksToCreate.length) {
      await link.create(linksToCreate)
    }
  } catch (error) {
    console.error("Failed to link vendor to placed order:", error)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
