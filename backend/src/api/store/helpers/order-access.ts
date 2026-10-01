import type { MedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getVisibleCustomerIds } from "./quote-access"

/**
 * Who may read an order from the storefront.
 *
 *  - A seller's CHILD order (see lib/split-order.ts) is never the buyer's: they
 *    paid for the parent. It has no customer id, so without this rule it would
 *    look like a guest order and anyone holding its id could read it.
 *  - An order that belongs to a customer: that customer, and their company
 *    colleagues, when signed in.
 *  - A guest order: the id is the capability, as on the confirmation page a guest
 *    lands on right after paying. Medusa gives a guest a placeholder customer
 *    (has_account = false) on checkout, so "guest" means no customer OR a customer
 *    without an account.
 * Anyone else gets "not found", never "forbidden", so ids cannot be probed.
 */
export const canBuyerSeeOrder = async (
  req: MedusaRequest,
  order: { customer_id?: string | null; metadata?: Record<string, any> | null }
): Promise<boolean> => {
  if (order.metadata?.split_child) {
    return false
  }
  if (!order.customer_id) {
    return true
  }
  const query: any = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [customer],
  } = await query.graph({ entity: "customer", fields: ["id", "has_account"], filters: { id: order.customer_id } })
  if (customer && customer.has_account === false) {
    return true
  }
  const visible = await getVisibleCustomerIds(req)
  return visible.includes(order.customer_id)
}
