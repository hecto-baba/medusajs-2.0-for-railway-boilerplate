import { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { splitOrderBySeller } from "../lib/split-order"

/**
 * Gives every seller an order of their own when an order is placed.
 *
 * One seller's order is linked to that seller directly; an order with several
 * sellers' items (or platform items too) is split into one child order per
 * seller. See lib/split-order.ts.
 */
export default async function linkVendorOrderHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  try {
    await splitOrderBySeller(container, data.id)
  } catch (error) {
    // Safe to retry: splitOrderBySeller skips sellers that already have a child.
    console.error("Failed to give sellers their orders for placed order:", data.id, error)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
