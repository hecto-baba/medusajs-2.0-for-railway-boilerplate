import { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { sendBuyerFulfillmentEmail } from "../lib/buyer-fulfillment-email"

/** Emails the buyer when a seller marks part of their order delivered. */
export default async function buyerDeliveryEmailHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string; no_notification?: boolean }>) {
  await sendBuyerFulfillmentEmail(container, {
    fulfillment_id: data.id,
    kind: "delivered",
    no_notification: data.no_notification,
  })
}

export const config: SubscriberConfig = {
  event: "delivery.created",
}
