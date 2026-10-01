import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createEoiOrderWorkflow } from "../../../../workflows/create-eoi-order"
import { MedusaError } from "@medusajs/framework/utils"

/**
 * Mirrors src/api/store/rentals/[cart_id]/route.ts structurally, but adds
 * error handling the sibling route omits: a raw workflow error should not
 * propagate unwrapped to the client.
 *
 * This is the endpoint the storefront calls instead of the generic
 * cart-complete endpoint when the cart contains an EOI item - same
 * convention rentals already established for /store/rentals/:cart_id.
 */
export const POST = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const { cart_id } = req.params

  try {
    const { result } = await createEoiOrderWorkflow(req.scope).run({
      input: { cart_id },
    })

    res.json({ type: "order", order: result.order })
  } catch (error) {
    if (error instanceof MedusaError) {
      throw error
    }
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Could not complete EOI order for cart ${cart_id}: ${(error as Error).message}`
    )
  }
}
