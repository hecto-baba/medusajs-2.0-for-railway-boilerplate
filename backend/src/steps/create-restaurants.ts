import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { RESTAURANT_MODULE } from "../modules/restaurant"
import RestaurantModuleService from "../modules/restaurant/service"

export interface StepInput {
  name: string
  handle: string
  phone: string
  email: string
  address: string
  is_open?: boolean
  description?: string | null
  image_url?: string | null
}

export const createRestaurantsStep = createStep(
  "create-restaurants-step",
  async (input: StepInput, { container }) => {
    const restaurantModule: RestaurantModuleService = container.resolve(RESTAURANT_MODULE)
    const restaurant = await restaurantModule.createRestaurants(input)

    return new StepResponse(restaurant, restaurant.id)
  },
  async (restaurantId: string, { container }) => {
    if (!restaurantId) return
    const restaurantModule: RestaurantModuleService = container.resolve(RESTAURANT_MODULE)
    await restaurantModule.deleteRestaurants([restaurantId])
  }
)
