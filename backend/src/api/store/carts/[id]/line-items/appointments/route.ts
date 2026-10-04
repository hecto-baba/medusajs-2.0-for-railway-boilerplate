import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { addToCartWithAppointmentWorkflow } from "../../../../../../workflows/add-to-cart-with-appointment"
import { canUseCart } from "../../../../helpers/cart-access"

/**
 * The client picks WHICH resource, WHICH variant and WHEN. It never sends a
 * price or a quantity: both are decided on the server.
 */
export const PostCartItemsAppointmentsBody = z.object({
  resource_id: z.string().min(1),
  variant_id: z.string().min(1),
  start: z.coerce.date(),
  buyer: z.object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(254),
    phone: z.string().trim().max(40).nullable().optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
  }),
})

export const POST = async (
  req: MedusaRequest<z.infer<typeof PostCartItemsAppointmentsBody>>,
  res: MedusaResponse
) => {
  const { id: cart_id } = req.params

  // Same rule as every other marketplace cart route: a guest cart is held by
  // whoever has its id; a customer's cart only by that customer.
  if (!(await canUseCart(req, cart_id))) {
    return res.status(404).json({ message: "Cart not found" })
  }

  const { resource_id, variant_id, start, buyer } = req.validatedBody

  const { result } = await addToCartWithAppointmentWorkflow(req.scope).run({
    input: {
      cart_id,
      resource_id,
      variant_id,
      start: start.toISOString(),
      buyer,
    },
  })

  res.json({ cart: result.cart, hold: result.hold })
}
