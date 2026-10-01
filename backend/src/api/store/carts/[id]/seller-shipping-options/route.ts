import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listShippingOptionsForCartWithPricingWorkflow } from "@medusajs/medusa/core-flows"
import { getCartShippingGroups } from "../../../../../lib/cart-shipping"

/**
 * Shipping choices for a cart, one group per seller (Phase 2, step 3).
 *
 * Medusa's own GET /store/shipping-options returns every option of the sales
 * channel in one flat list. Here each group lists only the options that ship
 * that group's items (same shipping profile), so a buyer picks one method per
 * seller and never sees another seller's options.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params

  const groups = await getCartShippingGroups(req.scope, id)

  const { result: options } = await listShippingOptionsForCartWithPricingWorkflow(req.scope).run({
    input: { cart_id: id, is_return: false },
  })

  const shippingGroups = groups.map((group) => ({
    ...group,
    shipping_options: (options as any[]).filter(
      (option) => option.shipping_profile_id === group.shipping_profile_id
    ),
  }))

  res.json({ shipping_groups: shippingGroups })
}
