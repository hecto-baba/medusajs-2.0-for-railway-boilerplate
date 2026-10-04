import { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { splitOrderBySeller } from "../lib/split-order"
import { sendVendorOrderEmails } from "../lib/vendor-order-emails"

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
  let mode: "none" | "single" | "split" | "child" = "none"
  try {
    mode = (await splitOrderBySeller(container, data.id)).mode
  } catch (error) {
    // Safe to retry: splitOrderBySeller skips sellers that already have a child.
    console.error("Failed to give sellers their orders for placed order:", data.id, error)
    return
  }

  // Sellers hear about their order only once it exists. A failed email never
  // undoes the split (sendVendorOrderEmails does not throw).
  await sendVendorOrderEmails(container, data.id, mode)
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
