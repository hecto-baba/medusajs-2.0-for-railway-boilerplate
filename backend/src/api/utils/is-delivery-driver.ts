import { 
  AuthenticatedMedusaRequest, 
  MedusaNextFunction, 
  MedusaResponse
} from "@medusajs/framework/http"
import { DELIVERY_MODULE } from "../../modules/delivery"
import DeliveryModuleService from "../../modules/delivery/service"

export const isDeliveryDriver = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) => {
  if (!req.auth_context?.actor_id || req.auth_context.actor_type !== "driver") {
    return next()
  }

  try {
    const deliveryModuleService: DeliveryModuleService = req.scope.resolve(
      DELIVERY_MODULE
    )

    const delivery = await deliveryModuleService.retrieveDelivery(
      req.params.id,
      {
        relations: ["driver"]
      }
    )

    if (!delivery || (delivery as any).driver?.id !== req.auth_context.actor_id) {
      return res.status(403).json({
        message: "unauthorized"
      })
    }
  } catch (err) {}

  next()
}
