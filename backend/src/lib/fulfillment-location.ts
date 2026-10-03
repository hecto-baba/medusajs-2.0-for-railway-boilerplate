import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"

/**
 * The stock location an order is fulfilled from (Phase 4, step 5).
 *
 * The restaurant delivery flow used to fulfil every order from a location
 * hard-coded as "loc_1" (a seed id that exists in no real database). Now:
 *  1. the location of the shipping option the buyer chose, which is the seller's
 *     own location (Phase 2), else
 *  2. the first stock location of the seller that owns the order's first product.
 * If neither exists the order cannot be fulfilled and a clear error says why, so
 * nothing is ever silently shipped from the wrong place.
 */
export const resolveFulfillmentLocation = async (
  container: MedusaContainer,
  orderId: string
): Promise<string> => {
  const query: any = container.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [order],
  } = await query.graph({
    entity: "order",
    fields: ["id", "shipping_methods.shipping_option_id", "items.product_id"],
    filters: { id: orderId },
  })

  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Order ${orderId} was not found.`)
  }

  const optionIds = ((order.shipping_methods ?? []) as any[])
    .map((method) => method.shipping_option_id)
    .filter((id): id is string => !!id)

  if (optionIds.length) {
    const { data: options } = await query.graph({
      entity: "shipping_option",
      fields: ["id", "service_zone.fulfillment_set.location.id"],
      filters: { id: optionIds },
    })
    for (const option of options as any[]) {
      const locationId = option.service_zone?.fulfillment_set?.location?.id
      if (locationId) {
        return locationId
      }
    }
  }

  const productIds = ((order.items ?? []) as any[]).map((item) => item.product_id).filter((id): id is string => !!id)
  if (productIds.length) {
    const { data: vendors } = await query.graph({
      entity: "vendor",
      fields: ["id", "products.id", "stock_locations.id"],
    })
    for (const vendor of vendors as any[]) {
      const sells = (vendor.products ?? []).some((product: any) => productIds.includes(product.id))
      const location = vendor.stock_locations?.[0]?.id
      if (sells && location) {
        return location
      }
    }
  }

  throw new MedusaError(
    MedusaError.Types.NOT_ALLOWED,
    `Cannot choose a stock location to fulfil order ${orderId} from: its shipping option has no location and its seller has none.`
  )
}
