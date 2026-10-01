import {
  createWorkflow,
  WorkflowResponse,
  when,
} from "@medusajs/framework/workflows-sdk"
import {
  useQueryGraphStep,
  markOrderFulfillmentAsDeliveredWorkflow,
} from "@medusajs/medusa/core-flows"
import {
  sendDigitalOrderNotificationStep,
  SendDigitalOrderNotificationStepInput,
} from "./steps/send-digital-order-notification"

type FulfillDigitalOrderWorkflowInput = {
  id: string
}

export const fulfillDigitalOrderWorkflow = createWorkflow(
  "fulfill-digital-order",
  ({ id }: FulfillDigitalOrderWorkflowInput) => {
    const { data: digitalProductOrders } = useQueryGraphStep({
      entity: "digital_product_order",
      fields: [
        "*",
        "products.*",
        "products.medias.*",
        "order.*",
        "order.fulfillments.*",
      ],
      filters: {
        id,
      },
      options: {
        throwIfKeyNotFound: true,
      },
    })

    sendDigitalOrderNotificationStep({
      digital_product_order: digitalProductOrders[0],
    } as unknown as SendDigitalOrderNotificationStepInput)

    when(
      { digitalProductOrders },
      (data) => !!data.digitalProductOrders[0].order?.fulfillments?.length
    ).then(() => {
      markOrderFulfillmentAsDeliveredWorkflow.runAsStep({
        input: {
          orderId: digitalProductOrders[0].order!.id,
          fulfillmentId: digitalProductOrders[0].order!.fulfillments![0]!.id,
          no_notification: true,
        },
      })
    })

    return new WorkflowResponse(digitalProductOrders[0])
  }
)
