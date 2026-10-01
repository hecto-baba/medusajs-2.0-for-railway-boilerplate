import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { DELIVERY_MODULE } from "../../../modules/delivery"
import DeliveryModuleService from "../../../modules/delivery/service"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const deliveryModule: DeliveryModuleService = req.scope.resolve(DELIVERY_MODULE)
  const drivers = await deliveryModule.listDrivers({})
  return res.json({ drivers })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const deliveryModule: DeliveryModuleService = req.scope.resolve(DELIVERY_MODULE)
  const body = (req.body || {}) as any

  const driver = await deliveryModule.createDrivers({
    first_name: body.first_name || "Unknown",
    last_name: body.last_name || "Driver",
    email: body.email || `driver_${Date.now()}@example.com`,
    phone: body.phone || "N/A",
    avatar_url: body.avatar_url || null,
  })

  return res.status(201).json({ driver })
}
