import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { DELIVERY_MODULE } from "../../../../modules/delivery"
import DeliveryModuleService from "../../../../modules/delivery/service"
import { DeliveryStatus } from "../../../../modules/delivery/types"

function setCorsHeaders(req: MedusaRequest, res: MedusaResponse) {
  const origin = (req.headers.origin as string) || "*"
  res.setHeader("Access-Control-Allow-Origin", origin)
  res.setHeader("Access-Control-Allow-Credentials", "true")
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-publishable-api-key"
  )
}

export async function OPTIONS(req: MedusaRequest, res: MedusaResponse) {
  setCorsHeaders(req, res)
  return res.status(204).end()
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  setCorsHeaders(req, res)
  const { id } = req.params

  const deliveryModuleService: DeliveryModuleService = req.scope.resolve(DELIVERY_MODULE)
  const updated = await deliveryModuleService.updateDeliveries([
    {
      id,
      delivery_status: DeliveryStatus.PENDING,
      driver_id: null,
      delivered_at: null,
    } as any,
  ])

  return res.status(200).json({ delivery: Array.isArray(updated) ? updated[0] : updated })
}