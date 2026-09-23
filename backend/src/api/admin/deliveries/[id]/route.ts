import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { DELIVERY_MODULE } from "../../../../modules/delivery"
import DeliveryModuleService from "../../../../modules/delivery/service"
import { DeliveryStatus } from "../../../../modules/delivery/types"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: [delivery] } = await query.graph({
      entity: "delivery",
      fields: [
        "id",
        "transaction_id",
        "delivery_status",
        "eta",
        "delivered_at",
        "driver.*",
        "restaurant.*",
        "order.*",
      ],
      filters: {
        id,
      },
    })
    if (delivery) {
      return res.json({ delivery })
    }
  } catch (err) {
    // If graph resolution fails, fall back to module retrieve
  }

  const deliveryModule: DeliveryModuleService = req.scope.resolve(DELIVERY_MODULE)
  const delivery = await deliveryModule.retrieveDelivery(id, {
    relations: ["driver"],
  })
  return res.json({ delivery })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params
  const deliveryModule: DeliveryModuleService = req.scope.resolve(DELIVERY_MODULE)
  const body = (req.body || {}) as any

  const updateData: Record<string, any> = { id }

  if (body.delivery_status !== undefined) {
    updateData.delivery_status = body.delivery_status
    if (body.delivery_status === DeliveryStatus.DELIVERED && !body.delivered_at) {
      updateData.delivered_at = new Date()
    }
  }

  if (body.driver_id !== undefined) {
    updateData.driver_id = body.driver_id || null
  }

  if (body.eta !== undefined) {
    updateData.eta = body.eta ? new Date(body.eta) : null
  }

  if (body.delivered_at !== undefined) {
    updateData.delivered_at = body.delivered_at ? new Date(body.delivered_at) : null
  }

  if (body.transaction_id !== undefined) {
    updateData.transaction_id = body.transaction_id
  }

  const delivery = await deliveryModule.updateDeliveries(updateData)

  // Re-fetch with driver relation populated
  const updatedDelivery = await deliveryModule.retrieveDelivery(id, {
    relations: ["driver"],
  })

  return res.status(200).json({ delivery: updatedDelivery })
}
