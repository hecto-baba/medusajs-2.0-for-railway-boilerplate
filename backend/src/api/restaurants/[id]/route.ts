import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { RESTAURANT_MODULE } from "../../../modules/restaurant"


function setCorsHeaders(req: MedusaRequest, res: MedusaResponse) {
  const origin = (req.headers.origin as string) || "*"
  res.setHeader("Access-Control-Allow-Origin", origin)
  res.setHeader("Access-Control-Allow-Credentials", "true")
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-publishable-api-key"
  )
}

export async function OPTIONS(req: MedusaRequest, res: MedusaResponse) {
  setCorsHeaders(req, res)
  return res.status(204).end()
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  setCorsHeaders(req, res)
  const id = req.params.id

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
        "products.categories.*",
        "products.variants.*",
        "products.variants.prices.*",
      ],
      filters: {
        id,
      },
    })

    if (restaurant) {
      return res.status(200).json({ restaurant })
    }
  } catch (err) {
    console.error("Error querying restaurant by id:", err)
  }


  try {
    const restaurantModule = req.scope.resolve(RESTAURANT_MODULE) as any
    const restaurant = await restaurantModule.retrieveRestaurant(id)
    return res.status(200).json({ restaurant })
  } catch (err) {
    return res.status(404).json({ message: `Restaurant with id ${id} not found` })
  }
}