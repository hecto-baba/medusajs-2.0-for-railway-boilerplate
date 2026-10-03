import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { canUseCart } from "../helpers/cart-access"
import { createDeliveryWorkflow } from "../../../workflows/delivery/workflows/create-delivery"
import { handleDeliveryWorkflow } from "../../../workflows/delivery/workflows/handle-delivery"

const schema = z.object({
  cart_id: z.string(),
  restaurant_id: z.string(),
})

// CORS comes from the store's configured origins. This file used to reflect ANY request
// origin with credentials allowed, which let any website call it as the signed-in buyer.

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const validatedBody = schema.parse(req.body)

  if (!(await canUseCart(req, validatedBody.cart_id))) {
    return res.status(404).json({ message: "Cart not found" })
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

  return res
    .status(200)
    .json({ message: "Delivery created", delivery, transaction })
}
