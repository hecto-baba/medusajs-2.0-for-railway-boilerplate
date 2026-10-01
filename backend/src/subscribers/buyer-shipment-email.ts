import { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { sendBuyerFulfillmentEmail } from "../lib/buyer-fulfillment-email"

/** Emails the buyer when a seller ships part of their order. */
export default async function buyerShipmentEmailHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string; no_notification?: boolean }>) {
  await sendBuyerFulfillmentEmail(container, {
    fulfillment_id: data.id,
    kind: "shipped",
    no_notification: data.no_notification,
  })
}

export const config: SubscriberConfig = {
  event: "shipment.created",
}
