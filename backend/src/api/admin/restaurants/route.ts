import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { RESTAURANT_MODULE } from "../../../modules/restaurant"
import RestaurantModuleService from "../../../modules/restaurant/service"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const restaurantModule: RestaurantModuleService = req.scope.resolve(RESTAURANT_MODULE)
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 15
  const offset = req.query.offset ? parseInt(req.query.offset as string) : 0
  const filters: Record<string, any> = {}

  if (req.query.q) {
    filters.name = req.query.q
  }

  if (req.query.is_open !== undefined) {
    filters.is_open = req.query.is_open === "true"
  }

  const [restaurants, count] = await restaurantModule.listAndCountRestaurants(
    filters,
    {
      take: limit,
      skip: offset,
      order: req.query.order
        ? {
            [((req.query.order as string).startsWith("-")
              ? (req.query.order as string).slice(1)
              : (req.query.order as string))]: (req.query.order as string).startsWith("-")
              ? "DESC"
              : "ASC",
          }
        : undefined,
    }
  )

  res.json({
    restaurants,
    count,
    limit,
    offset,
  })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const restaurantModule: RestaurantModuleService = req.scope.resolve(RESTAURANT_MODULE)
  const body = (req.body || {}) as any
  const handle =
    body.handle ||
    (body.name
      ? body.name
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")
      : undefined)

  const data = {
    phone: "N/A",
    email: "info@restaurant.com",
    address: "N/A",
    ...body,
    ...(handle ? { handle } : {}),
  }

  const restaurant = await restaurantModule.createRestaurants(data)
  res.status(200).json({ restaurant })
}
