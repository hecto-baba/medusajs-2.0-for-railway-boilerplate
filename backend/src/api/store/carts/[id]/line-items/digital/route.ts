import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { addToCartWorkflow } from "@medusajs/medusa/core-flows"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { canUseCart } from "../../../../helpers/cart-access"

export const PostCartItemsDigitalBody = z.object({
  variant_id: z.string(),
  quantity: z.number().int().min(1),
})

/**
 * Adds a digital product to the cart as a line that needs no shipping.
 *
 * A digital download is delivered by email or from the account page, so the
 * cart must not ask for a delivery address or a shipping method. Medusa's
 * ordinary add-to-cart derives that from the variant's inventory item, which
 * digital variants do not set, so the line is created here with
 * `requires_shipping: false` explicitly, the same way tickets are.
 *
 * Only a variant that really has a digital product is accepted: otherwise this
 * route would let a physical product skip shipping.
 */
export const POST = async (
  req: MedusaRequest<z.infer<typeof PostCartItemsDigitalBody>>,
  res: MedusaResponse
) => {
  const { id: cart_id } = req.params
  const { variant_id, quantity } = req.validatedBody

  if (!(await canUseCart(req, cart_id))) {
    return res.status(404).json({ message: "Cart not found" })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: ["id", "digital_product.id"],
    filters: { id: variant_id },
  })

  if (!variants[0]?.digital_product) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Variant ${variant_id} is not a digital product`
    )
  }

  await addToCartWorkflow(req.scope).run({
    input: {
      cart_id,
      items: [{ variant_id, quantity, requires_shipping: false } as any],
    },
  })

  const { data: carts } = await query.graph({
    entity: "cart",
    fields: ["id", "items.id", "items.variant_id", "items.quantity"],
    filters: { id: cart_id },
  })

  res.json({ cart: carts[0] })
}
