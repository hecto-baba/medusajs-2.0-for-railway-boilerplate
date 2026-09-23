import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { DELIVERY_MODULE } from "../../../modules/delivery"
import DeliveryModuleService from "../../../modules/delivery/service"

export const setTransactionIdStep = createStep(
  "set-transaction-id-step",
  async function (deliveryId: string, { container, context }) {
    const service: DeliveryModuleService = container.resolve(DELIVERY_MODULE)
    const delivery = await service.updateDeliveries({ id: deliveryId, transaction_id: context.transactionId })
    return new StepResponse(delivery, { id: delivery.id, transaction_id: null })
  },
  async function (data, { container }) {
    if (!data) return
    const service: DeliveryModuleService = container.resolve(DELIVERY_MODULE)
    await service.updateDeliveries(data)
  }
)
