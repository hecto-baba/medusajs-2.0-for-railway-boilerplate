import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { DELIVERY_MODULE } from "../../../modules/delivery"
import DeliveryModuleService from "../../../modules/delivery/service"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const deliveryModule: DeliveryModuleService = req.scope.resolve(DELIVERY_MODULE)
  const drivers = await deliveryModule.listDrivers({})
  return res.json({ drivers })
}
