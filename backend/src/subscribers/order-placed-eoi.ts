import { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { persistEoisForOrder } from "../utils/persist-eois-for-order"

/**
 * Backstop for EOI persistence. create-eoi-order.ts is the intended checkout
 * path, but nothing stops a cart with EOI lines being completed through the
 * stock /store/carts/:id/complete route, or the workflow's own persistence
 * step skipping a line. Either way the order exists with is_eoi lines and no
 * Eoi rows. persistEoisForOrder is idempotent (it skips lines that already
 * have a row), so running it here is safe even when the workflow also ran.
 */
export default async function orderPlacedEoiHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const query = container.resolve("query")

  const {
    data: [order],
  } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "email",
      "customer_id",
      "items.id",
      "items.variant_id",
      "items.product_id",
      "items.quantity",
      "items.metadata",
    ],
    filters: { id: data.id },
  })

  if (!order) {
    return
  }

  await persistEoisForOrder(container, order as any)
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
