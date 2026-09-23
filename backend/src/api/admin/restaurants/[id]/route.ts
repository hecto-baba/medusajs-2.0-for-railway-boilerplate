import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { RESTAURANT_MODULE } from "../../../../modules/restaurant"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: [restaurant] } = await query.graph({
      entity: "restaurant",
      fields: [
        "id",
        "name",
        "handle",
        "is_open",
        "description",
        "phone",
        "email",
        "address",
        "image_url",
        "products.*",
        "products.variants.*",
        "products.variants.prices.*",
        "admins.*",
        "deliveries.*",
        "deliveries.driver.*",
      ],
      filters: {
        id: req.params.id,
      },
    })
    if (restaurant) {
      return res.json({ restaurant })
    }
  } catch {}

  const restaurantModule = req.scope.resolve(RESTAURANT_MODULE) as any
  const restaurant = await restaurantModule.retrieveRestaurant(req.params.id)
  return res.json({ restaurant })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const restaurantModule = req.scope.resolve(RESTAURANT_MODULE) as any
  const restaurant = await restaurantModule.updateRestaurants({
    id: req.params.id,
    ...((req.body || {}) as any),
  })
  return res.status(200).json({ restaurant })
}
