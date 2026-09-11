import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { addTicketsToCartWorkflow } from "../../../../../../workflows/add-tickets-to-cart"

/**
 * Seat metadata is required rather than optional: it is what marks a line item
 * as a ticket, both for the storefront checkout and for the completion
 * workflow that records which seats were sold.
 */
export const PostCartItemsTicketsBody = z.object({
  items: z
    .array(
      z.object({
        variant_id: z.string(),
        metadata: z.object({
          seat_number: z.string(),
          row_number: z.string(),
          venue_row_id: z.string(),
          show_date: z.string(),
          row_type: z.string(),
        }),
      })
    )
    .min(1),
})

/**
 * Adds ticket seats to a cart.
 *
 * Tickets go through this route instead of the standard line items route
 * because they must be added with requires_shipping false; see
 * addTicketsToCartWorkflow for why that cannot be left to Medusa to derive.
 */
export const POST = async (
  req: MedusaRequest<z.infer<typeof PostCartItemsTicketsBody>>,
  res: MedusaResponse
) => {
  const { id: cart_id } = req.params
  const { items } = req.validatedBody

  const { result } = await addTicketsToCartWorkflow(req.scope).run({
    input: { cart_id, items },
  })

  res.json({ cart: result.cart })
}
