import { OrderDTO } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

export const createFulfillmentStep = createStep(
  "create-fulfillment-step",
  async function (order: OrderDTO, { container }) {
    const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT) as any
    const items = order.items?.map((lineItem: any) => ({
      title: lineItem.title,
      sku: lineItem.variant_sku || "",
      quantity: lineItem.quantity,
      barcode: lineItem.variant_barcode || "",
      line_item_id: lineItem.id,
    }))
    const fulfillment = await fulfillmentModuleService.createFulfillment({
      provider_id: "manual_manual",
      location_id: "loc_1",
      delivery_address: order.shipping_address!,
      items: items || [],
      labels: [],
      order,
    })
    return new StepResponse(fulfillment, fulfillment.id)
  },
  function (id: string, { container }) {
    if (!id) return
    const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT) as any
    return fulfillmentModuleService.cancelFulfillment(id)
  }
)
