import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { addToCartWithAppointmentWorkflow } from "../../../../../../workflows/add-to-cart-with-appointment"

export const PostCartItemsAppointmentsBody = z.object({
  appointment_id: z.string(),
  variant_id: z.string(),
})

export const POST = async (
  req: MedusaRequest<z.infer<typeof PostCartItemsAppointmentsBody>>,
  res: MedusaResponse
) => {
  const { id: cart_id } = req.params
  const { appointment_id, variant_id } = req.validatedBody

  const { result } = await addToCartWithAppointmentWorkflow(req.scope).run({
    input: { cart_id, appointment_id, variant_id },
  })

  res.json({ cart: result.cart })
}
