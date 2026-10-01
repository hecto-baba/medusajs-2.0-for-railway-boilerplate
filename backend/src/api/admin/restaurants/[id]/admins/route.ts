import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { RESTAURANT_MODULE } from "../../../../../modules/restaurant"
import RestaurantModuleService from "../../../../../modules/restaurant/service"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params
  const restaurantModule: RestaurantModuleService = req.scope.resolve(RESTAURANT_MODULE)
  const admins = await restaurantModule.listRestaurantAdmins({
    restaurant_id: id,
  })
  return res.json({ admins })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params
  const restaurantModule: RestaurantModuleService = req.scope.resolve(RESTAURANT_MODULE)
  const body = (req.body || {}) as any

  const admin = await restaurantModule.createRestaurantAdmins({
    restaurant_id: id,
    first_name: body.first_name || "Staff",
    last_name: body.last_name || "Member",
    email: body.email,
  })

  return res.status(201).json({ admin })
}
