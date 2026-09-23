import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { fulfillDigitalOrderWorkflow } from "../workflows/fulfill-digital-order"

export default async function digitalProductOrderCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  await fulfillDigitalOrderWorkflow(container).run({
    input: {
      id: data.id,
    },
  })
}

export const config: SubscriberConfig = {
  event: "digital_product_order.created",
}
