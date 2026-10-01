import {
  createWorkflow,
  WorkflowResponse,
  transform,
  when
} from "@medusajs/framework/workflows-sdk"
import {
  completeCartWorkflow,
  createRemoteLinkStep,
  useQueryGraphStep,
  emitEventStep
} from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import createDigitalProductOrderStep from "./steps/create-digital-product-order"
import { DIGITAL_PRODUCT_MODULE } from "../../modules/digital-product"

export const completeCartDigitalWorkflow = createWorkflow(
  "complete-cart-digital",
  (input: { id: string }) => {
    const cartResult = completeCartWorkflow.runAsStep({
      input: { id: input.id },
    })

    const { data: orders } = useQueryGraphStep({
      entity: "order",
      fields: [
        "id",
        "items.*",
        "items.variant.*",
        "items.variant.digital_product.*"
      ],
      filters: { id: cartResult.id },
    })

    const digitalItems = transform(
      { orders },
      (data) => data.orders[0].items.filter(
        (item: any) => item.variant?.digital_product !== undefined
      )
    )

    const hasDigitalItems = transform(
      { digitalItems },
      (data) => data.digitalItems.length > 0
    )

    when({ hasDigitalItems }, (data) => data.hasDigitalItems)
      .then(() => {
        const { digital_product_order } = createDigitalProductOrderStep({
          items: digitalItems,
        })

        createRemoteLinkStep([{
          [DIGITAL_PRODUCT_MODULE]: {
            digital_product_order_id: digital_product_order.id,
          },
          [Modules.ORDER]: {
            order_id: cartResult.id,
          },
        }])

        emitEventStep({
          eventName: "digital_product_order.created",
          data: {
            id: digital_product_order.id,
            order_id: cartResult.id,
          },
        })
      })

    return new WorkflowResponse(cartResult)
  }
)

export default completeCartDigitalWorkflow
