import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { DELIVERY_MODULE } from "../../../modules/delivery"
import { UpdateDelivery } from "../../../modules/delivery/types"
import DeliveryModuleService from "../../../modules/delivery/service"

type UpdateDeliveryStepInput = { data: UpdateDelivery }

export const updateDeliveryStep = createStep(
  "update-delivery-step",
  async function ({ data }: UpdateDeliveryStepInput, { container }) {
    const deliveryModuleService: DeliveryModuleService = container.resolve(DELIVERY_MODULE)
    let delivery: any = null
    let prevDeliveryData: any = null

    try {
      prevDeliveryData = await deliveryModuleService.retrieveDelivery(data.id)
      const updated = await deliveryModuleService.updateDeliveries([data as any])
      delivery = Array.isArray(updated) ? updated[0] : updated
    } catch (e) {
      // If delivery record does not exist yet with this id, create it
      delivery = await deliveryModuleService.createDeliveries({
        id: data.id,
        delivery_status: data.delivery_status || "restaurant_accepted",
        eta: data.eta || new Date(Date.now() + 30 * 60 * 1000),
        driver_id: (data as any).driver_id || undefined,
        delivered_at: (data as any).delivered_at || undefined,
      } as any)
      prevDeliveryData = delivery
    }

    return new StepResponse(delivery, { prevDeliveryData })
  },
  async (data: any, { container }) => {
    if (!data?.prevDeliveryData) return
    const deliverModuleService: DeliveryModuleService = container.resolve(DELIVERY_MODULE)
    const { driver, ...prevDeliveryDataWithoutDriver } = data.prevDeliveryData
    try {
      await deliverModuleService.updateDeliveries(prevDeliveryDataWithoutDriver)
    } catch (e) {}
  }
)
