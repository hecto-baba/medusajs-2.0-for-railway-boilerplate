import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { RESTAURANT_MODULE } from "../../../modules/restaurant"
import RestaurantModuleService from "../../../modules/restaurant/service"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const restaurantModule: RestaurantModuleService = req.scope.resolve(RESTAURANT_MODULE)
  const restaurants = await restaurantModule.listRestaurants()

  res.status(200).json({ restaurants })
}
