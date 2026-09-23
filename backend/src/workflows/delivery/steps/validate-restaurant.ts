import { createStep } from "@medusajs/framework/workflows-sdk"
import { RESTAURANT_MODULE } from "../../../modules/restaurant"
import RestaurantModuleService from "../../../modules/restaurant/service"

type ValidateRestaurantStepInput = { restaurant_id: string }

export const validateRestaurantStep = createStep(
  "validate-restaurant",
  async ({ restaurant_id }: ValidateRestaurantStepInput, { container }) => {
    const restaurantModuleService: RestaurantModuleService = container.resolve(RESTAURANT_MODULE)
    await restaurantModuleService.retrieveRestaurant(restaurant_id)
  }
)
