import type {
  MedusaRequest,
  MedusaResponse
} from "@medusajs/framework/http"
import {
  addToCartWithEoiWorkflow
} from "../../../../../../workflows/add-to-cart-with-eoi"
import { z } from "@medusajs/framework/zod"
import { MedusaError } from "@medusajs/framework/utils"

export const PostCartItemsEoiBody = z.object({
  variant_id: z.string(),
  quantity: z.number(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const POST = async (
  req: MedusaRequest<z.infer<typeof PostCartItemsEoiBody>>,
  res: MedusaResponse
) => {
  const { id: cart_id } = req.params
  const { variant_id, quantity, metadata } = req.validatedBody

  try {
    const { result } = await addToCartWithEoiWorkflow(req.scope).run({
      input: {
        cart_id,
        variant_id,
        quantity,
        metadata,
      },
    })

    res.json({ cart: result.cart })
  } catch (error) {
    if (error instanceof MedusaError) {
      throw error
    }
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Could not add variant ${variant_id} to cart ${cart_id} as an Expression of Interest item: ${(error as Error).message}`
    )
  }
}
