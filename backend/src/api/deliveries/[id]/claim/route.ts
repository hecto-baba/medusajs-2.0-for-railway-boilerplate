import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { DELIVERY_MODULE } from "../../../../modules/delivery"
import DeliveryModuleService from "../../../../modules/delivery/service"
import { claimDeliveryWorkflow } from "../../../../workflows/delivery/workflows/claim-delivery"

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
  const deliveryId = req.params.id

  let driverId = (req as any).auth_context?.actor_id || (req.body as any)?.driver_id

  if (!driverId) {
    try {
      const deliveryService: DeliveryModuleService = req.scope.resolve(DELIVERY_MODULE)
      const drivers = await deliveryService.listDrivers({}, { take: 1 })
      if (drivers && drivers.length > 0) {
        driverId = drivers[0].id
      }
    } catch (e) {
      console.warn("Could not list drivers for fallback:", e)
    }
  }

  if (!driverId) {
    driverId = "driver_default"
  }

  const { result: claimedDelivery } = await claimDeliveryWorkflow(req.scope).run({
    input: {
      driver_id: driverId,
      delivery_id: deliveryId,
    },
  })

  return res.status(200).json({ delivery: claimedDelivery })
}
