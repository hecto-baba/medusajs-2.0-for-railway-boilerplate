import { createWorkflow, WorkflowResponse, transform } from "@medusajs/framework/workflows-sdk"
import { createRemoteLinkStep } from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import { validateRestaurantStep } from "../steps/validate-restaurant"
import { createDeliveryStep } from "../steps/create-delivery"
import { RESTAURANT_MODULE } from "../../../modules/restaurant"
import { DELIVERY_MODULE } from "../../../modules/delivery"

export const createDeliveryWorkflow = createWorkflow("create-delivery-workflow",
  function (input: { cart_id: string; restaurant_id: string }) {
    validateRestaurantStep({ restaurant_id: input.restaurant_id })
    const delivery = createDeliveryStep()
    const links = transform({ delivery, input }, (data) => [
      { [RESTAURANT_MODULE]: { restaurant_id: data.input.restaurant_id }, [DELIVERY_MODULE]: { delivery_id: data.delivery.id } },
      { [DELIVERY_MODULE]: { delivery_id: data.delivery.id }, [Modules.CART]: { cart_id: data.input.cart_id } }
    ])
    createRemoteLinkStep(links)
    return new WorkflowResponse(delivery)
  }
)
