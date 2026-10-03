import type { MedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getVisibleCustomerIds } from "./quote-access"

/**
 * Who may complete or change a cart through the marketplace's own cart routes
 * (complete, rentals, expressions of interest, approvals, deliveries).
 *
 * A guest cart (no customer) is held by whoever has its id, as in Medusa's own
 * cart routes. A cart that belongs to a customer may be used only by that
 * customer or, for company carts, a colleague. These routes also RETURN the
 * finished order (address, email), so a stray cart id must not be enough.
 * Anyone else gets "not found".
 */
export const canUseCart = async (req: MedusaRequest, cartId: string): Promise<boolean> => {
  const query: any = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [cart],
  } = await query.graph({ entity: "cart", fields: ["id", "customer_id"], filters: { id: cartId } })

  if (!cart) {
    return false
  }
  if (!cart.customer_id) {
    return true
  }
  // A guest checkout attaches a placeholder customer without an account; the cart is
  // still the guest's to complete by its id.
  const {
    data: [customer],
  } = await query.graph({ entity: "customer", fields: ["id", "has_account"], filters: { id: cart.customer_id } })
  if (customer && customer.has_account === false) {
    return true
  }
  const visible = await getVisibleCustomerIds(req)
  return visible.includes(cart.customer_id)
}
