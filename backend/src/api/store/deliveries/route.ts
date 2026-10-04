import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { canUseCart } from "../helpers/cart-access"
import { canBuyerSeeOrder } from "../helpers/order-access"
import { createDeliveryWorkflow } from "../../../workflows/delivery/workflows/create-delivery"
import { handleDeliveryWorkflow } from "../../../workflows/delivery/workflows/handle-delivery"

const schema = z.object({
  cart_id: z.string(),
  restaurant_id: z.string(),
  // The buyer's real order. The delivery is noted on it so the order pages can
  // offer a "Track your order" link.
  order_id: z.string().optional(),
})

// CORS comes from the store's configured origins. This file used to reflect ANY request
// origin with credentials allowed, which let any website call it as the signed-in buyer.

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const validatedBody = schema.parse(req.body)

  if (!(await canUseCart(req, validatedBody.cart_id))) {
    return res.status(404).json({ message: "Cart not found" })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  // A delivery is for food. The caller names the restaurant, so check the cart
  // really holds a dish from it rather than trusting the request: a booking or
  // a rental must never become a delivery.
  const {
    data: [cart],
  } = await query.graph({
    entity: "cart",
    fields: ["id", "items.id", "items.metadata"],
    filters: { id: validatedBody.cart_id },
  })
  const hasDish = ((cart as any)?.items ?? []).some(
    (item: any) => item?.metadata?.restaurant_id === validatedBody.restaurant_id
  )
  if (!hasDish) {
    return res.status(400).json({ message: "The cart has no items from this restaurant" })
  }

  // The order that gets the "Track your order" link. It must be one this buyer
  // may see, and one that has no delivery yet: a repeated call (double click,
  // retry) returns the existing delivery instead of creating a second one.
  let order: { id: string; metadata?: Record<string, any> | null } | undefined
  if (validatedBody.order_id) {
    const {
      data: [found],
    } = await query.graph({
      entity: "order",
      fields: ["id", "customer_id", "metadata"],
      filters: { id: validatedBody.order_id },
    })
    if (!found || !(await canBuyerSeeOrder(req, found as any))) {
      return res.status(404).json({ message: "Order not found" })
    }
    order = found as any

    const existingId = order?.metadata?.delivery_id
    if (typeof existingId === "string" && existingId) {
      return res
        .status(200)
        .json({ message: "Delivery already created", delivery: { id: existingId } })
    }
  }

  const { result: delivery } = await createDeliveryWorkflow(req.scope).run({
    input: {
      cart_id: validatedBody.cart_id,
      restaurant_id: validatedBody.restaurant_id,
    },
  })

  const { transaction } = await handleDeliveryWorkflow(req.scope).run({
    input: {
      delivery_id: delivery.id,
    },
  })

  if (order) {
    try {
      const orderModule = req.scope.resolve(Modules.ORDER) as any
      await orderModule.updateOrders([
        {
          id: order.id,
          metadata: { ...(order.metadata ?? {}), delivery_id: delivery.id },
        },
      ])
    } catch (err) {
      // The delivery exists either way; only the tracking link is lost.
      console.error("Failed to note the delivery on the order:", err)
    }
  }

  return res
    .status(200)
    .json({ message: "Delivery created", delivery, transaction })
}
