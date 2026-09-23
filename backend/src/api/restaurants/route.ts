import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createRestaurantWorkflow } from "../../workflows/restaurant/workflows/create-restaurant"
import { CreateRestaurant } from "../../modules/restaurant/types"
import { restaurantSchema } from "./validation-schemas"

function setCorsHeaders(req: MedusaRequest, res: MedusaResponse) {
  const origin = (req.headers.origin as string) || "*"
  res.setHeader("Access-Control-Allow-Origin", origin)
  res.setHeader("Access-Control-Allow-Credentials", "true")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-publishable-api-key"
  )
}

export async function OPTIONS(req: MedusaRequest, res: MedusaResponse) {
  setCorsHeaders(req, res)
  return res.status(204).end()
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  setCorsHeaders(req, res)
  const validatedBody = restaurantSchema.parse(req.body) as CreateRestaurant
  if (!validatedBody) {
    return MedusaError.Types.INVALID_DATA
  }

  const { result: restaurant } = await createRestaurantWorkflow(req.scope).run({
    input: {
      restaurant: validatedBody,
    },
  })

  return res.status(200).json({ restaurant })
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  setCorsHeaders(req, res)
  const { currency_code = "eur", ...queryFilters } = req.query
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  try {
    const { data: restaurants } = await query.graph({
      entity: "restaurant",
      fields: [
        "id",
        "handle",
        "name",
        "address",
        "phone",
        "email",
        "image_url",
        "is_open",
        "products.*",
        "products.categories.*",
        "products.variants.*",
        "products.variants.prices.*",
      ],
      filters: queryFilters,
    })

    return res.status(200).json({ restaurants })
  } catch (e) {
    const restaurantModule: any = req.scope.resolve("restaurantModuleService")
    const restaurants = await restaurantModule.listRestaurants(queryFilters)
    return res.status(200).json({ restaurants })
  }
}
