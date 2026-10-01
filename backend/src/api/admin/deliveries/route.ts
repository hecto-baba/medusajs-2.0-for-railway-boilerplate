import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { DELIVERY_MODULE } from "../../../modules/delivery"
import DeliveryModuleService from "../../../modules/delivery/service"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const deliveryModule: DeliveryModuleService = req.scope.resolve(DELIVERY_MODULE)
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 15
  const offset = req.query.offset ? parseInt(req.query.offset as string) : 0
  const filters: Record<string, any> = {}

  if (req.query.status) {
    filters.delivery_status = req.query.status
  }

  const [deliveries, count] = await deliveryModule.listAndCountDeliveries(
    filters,
    {
      take: limit,
      skip: offset,
      relations: ["driver"],
    }
  )

  res.json({
    deliveries,
    count,
    limit,
    offset,
  })
}
