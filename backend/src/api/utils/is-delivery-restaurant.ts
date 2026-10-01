import { 
  AuthenticatedMedusaRequest, 
  MedusaNextFunction, 
  MedusaResponse
} from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
} from "@medusajs/framework/utils"
import { RESTAURANT_MODULE } from "../../modules/restaurant"
import RestaurantModuleService from "../../modules/restaurant/service"

export const isDeliveryRestaurant = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) => {
  if (!req.auth_context?.actor_id || req.auth_context.actor_type !== "restaurant") {
    return next()
  }

  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const restaurantModuleService: RestaurantModuleService = req.scope.resolve(
      RESTAURANT_MODULE
    )

    const restaurantAdmin = await restaurantModuleService.retrieveRestaurantAdmin(
      req.auth_context.actor_id,
      {
        relations: ["restaurant"]
      }
    )

    const { data: [delivery] } = await query.graph({
      entity: "delivery",
      fields: [
        "restaurant.*"
      ],
      filters: {
        id: req.params.id
      }
    })

    if (!delivery || (delivery as any).restaurant?.id !== (restaurantAdmin as any)?.restaurant?.id) {
      return res.status(403).json({
        message: "unauthorized"
      })
    }
  } catch (err) {
    // Graceful continuation
  }

  next()
}
