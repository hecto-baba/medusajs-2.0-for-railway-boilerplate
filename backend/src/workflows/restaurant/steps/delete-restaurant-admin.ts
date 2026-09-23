import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { RESTAURANT_MODULE } from "../../../modules/restaurant"
import RestaurantModuleService from "../../../modules/restaurant/service"

export type DeleteRestaurantAdminStepInput = {
  id: string
}

export const deleteRestaurantAdminStep = createStep(
  "delete-restaurant-admin",
  async ({ id }: DeleteRestaurantAdminStepInput, { container }) => {
    const restaurantModuleService: RestaurantModuleService = container.resolve(
      RESTAURANT_MODULE
    )
    const admin = await restaurantModuleService.retrieveRestaurantAdmin(id)
    await restaurantModuleService.deleteRestaurantAdmins(id)
    return new StepResponse(undefined, { admin })
  },
  async (data, { container }) => {
    if (!data) {
      return
    }
    const restaurantModuleService: RestaurantModuleService = container.resolve(
      RESTAURANT_MODULE
    )
    const { restaurant: _, ...adminData } = data.admin as any
    await restaurantModuleService.createRestaurantAdmins(adminData)
  }
)
