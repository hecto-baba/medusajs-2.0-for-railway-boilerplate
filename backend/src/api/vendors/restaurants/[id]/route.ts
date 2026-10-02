import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { RESTAURANT_MODULE } from "../../../../modules/restaurant"
import RestaurantModuleService from "../../../../modules/restaurant/service"

export async function assertVendorOwnsRestaurant(
  req: AuthenticatedMedusaRequest,
  restaurantId: string
) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["id", "email", "vendor.id"],
    filters: { id: [req.auth_context.actor_id] },
  })

  if (!vendorAdmin) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Vendor not found.")
  }

  const {
    data: [restaurant],
  } = await query.graph({
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
    filters: { id: restaurantId },
  })

  if (!restaurant) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Restaurant not found.")
  }

  // Check if vendor admin is listed as an admin or owner
  const isAdmin = (restaurant.admins || []).some(
    (a: any) => a.email?.toLowerCase() === vendorAdmin.email?.toLowerCase()
  )

  if (isAdmin) {
    return restaurant
  }

  // Also check if linked via vendor.restaurants
  try {
    const { data: [vendor] } = await query.graph({
      entity: "vendor",
      fields: ["id", "restaurants.id"],
      filters: { id: [vendorAdmin.vendor.id] },
    })
    const hasRestaurant = (vendor?.restaurants || []).some((r: any) => r.id === restaurantId)
    if (hasRestaurant) {
      return restaurant
    }
  } catch {}

  throw new MedusaError(MedusaError.Types.NOT_FOUND, "Restaurant not found.")
}

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const restaurant = await assertVendorOwnsRestaurant(req, req.params.id)
  return res.json({ restaurant })
}

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  await assertVendorOwnsRestaurant(req, req.params.id)

  const restaurantModule: RestaurantModuleService = req.scope.resolve(RESTAURANT_MODULE)
  const body = (req.body || {}) as any

  const updateData: Record<string, any> = {
    id: req.params.id,
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.handle !== undefined ? { handle: body.handle } : {}),
    ...(body.is_open !== undefined ? { is_open: body.is_open } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.phone !== undefined ? { phone: body.phone } : {}),
    ...(body.email !== undefined ? { email: body.email } : {}),
    ...(body.address !== undefined ? { address: body.address } : {}),
    ...(body.image_url !== undefined ? { image_url: body.image_url } : {}),
  }

  const updatedRestaurant = await restaurantModule.updateRestaurants(updateData)
  return res.status(200).json({ restaurant: updatedRestaurant })
}
