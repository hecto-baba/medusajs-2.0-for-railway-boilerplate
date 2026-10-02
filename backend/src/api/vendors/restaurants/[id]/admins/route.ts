import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { RESTAURANT_MODULE } from "../../../../../modules/restaurant"
import RestaurantModuleService from "../../../../../modules/restaurant/service"
import { assertVendorOwnsRestaurant } from "../route"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await assertVendorOwnsRestaurant(req, req.params.id)
  const restaurantModule: RestaurantModuleService = req.scope.resolve(RESTAURANT_MODULE)
  const body = (req.body || {}) as any

  const admin = await (restaurantModule as any).createRestaurantAdmins({
    restaurant_id: req.params.id,
    first_name: body.first_name || "Kitchen",
    last_name: body.last_name || "Staff",
    email: body.email,
  })

  return res.status(201).json({ admin })
}
