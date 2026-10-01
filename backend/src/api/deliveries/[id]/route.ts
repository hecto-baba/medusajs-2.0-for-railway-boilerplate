import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { DELIVERY_MODULE } from "../../../modules/delivery"
import DeliveryModuleService from "../../../modules/delivery/service"

function setCorsHeaders(req: MedusaRequest, res: MedusaResponse) {
  const origin = (req.headers.origin as string) || "*"
  res.setHeader("Access-Control-Allow-Origin", origin)
  res.setHeader("Access-Control-Allow-Credentials", "true")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-publishable-api-key"
  )
}

export async function OPTIONS(req: MedusaRequest, res: MedusaResponse) {
  setCorsHeaders(req, res)
  return res.status(204).end()
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  setCorsHeaders(req, res)
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
      ],
      filters: {
        id,
      },
    })
    if (delivery) {
      return res.json({ delivery })
    }
  } catch (err) {
    // Fall back to module service
  }

  try {
    const deliveryModuleService: DeliveryModuleService = req.scope.resolve(DELIVERY_MODULE)
    const delivery = await deliveryModuleService.retrieveDelivery(id, {
      relations: ["driver"],
    })
    return res.json({ delivery })
  } catch (err) {
    const deliveryModuleService: DeliveryModuleService = req.scope.resolve(DELIVERY_MODULE)
    const delivery = await deliveryModuleService.createDeliveries({
      id,
      delivery_status: "pending",
      eta: new Date(Date.now() + 30 * 60 * 1000),
    } as any)
    return res.json({ delivery })
  }
}
