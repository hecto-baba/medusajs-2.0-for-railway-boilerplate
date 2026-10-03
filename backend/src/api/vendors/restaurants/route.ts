import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { RESTAURANT_MODULE } from "../../../modules/restaurant"
import RestaurantModuleService from "../../../modules/restaurant/service"
import { MARKETPLACE_MODULE } from "../../../modules/marketplace"
import { getVendorId } from "../shared/vendor-scope"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const restaurantModule: RestaurantModuleService = req.scope.resolve(RESTAURANT_MODULE)
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 20
  const offset = req.query.offset ? parseInt(req.query.offset as string) : 0

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["id", "email", "first_name", "last_name", "vendor.id"],
    filters: { id: [req.auth_context.actor_id] },
  })

  if (!vendorAdmin) {
    return res.status(401).json({ message: "Vendor not authenticated" })
  }

  // 1. Try finding restaurants linked by admin email
  let restaurants: any[] = []
  try {
    const { data: adminRestaurants } = await query.graph({
      entity: "restaurant",
      fields: [
        "id",
        "name",
        "handle",
        "is_open",
        "address",
        "phone",
        "email",
        "description",
        "image_url",
        "admins.*",
      ],
      filters: {
        admins: { email: vendorAdmin.email },
      },
    })
    if (adminRestaurants?.length) {
      restaurants.push(...adminRestaurants)
    }
  } catch {}

  // 2. Try finding restaurants linked via vendor remote link
  try {
    const { data: [vendorWithRestaurants] } = await query.graph({
      entity: "vendor",
      fields: ["id", "restaurants.*"],
      filters: { id: [vendorAdmin.vendor.id] },
    })
    if (vendorWithRestaurants?.restaurants?.length) {
      for (const r of vendorWithRestaurants.restaurants) {
        if (!restaurants.some((existing) => existing.id === r.id)) {
          restaurants.push(r)
        }
      }
    }
  } catch {}

  // Fallback: if no restaurants found, list via module if email matches or return empty
  if (!restaurants.length) {
    try {
      const all = await restaurantModule.listRestaurants({})
      restaurants = all.filter((r: any) => r.email === vendorAdmin.email)
    } catch {}
  }

  return res.json({
    restaurants: restaurants.slice(offset, offset + limit),
    count: restaurants.length,
    limit,
    offset,
  })
}

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const remoteLink = req.scope.resolve(ContainerRegistrationKeys.REMOTE_LINK)
  const restaurantModule: RestaurantModuleService = req.scope.resolve(RESTAURANT_MODULE)
  const vendorId = await getVendorId(req)

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["id", "email", "first_name", "last_name"],
    filters: { id: [req.auth_context.actor_id] },
  })

  const body = (req.body || {}) as any
  const handle =
    body.handle ||
    (body.name
      ? body.name
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")
      : `restaurant-${Date.now()}`)

  const restaurant = await restaurantModule.createRestaurants({
    name: body.name || "My Restaurant",
    handle,
    phone: body.phone || "N/A",
    email: body.email || vendorAdmin?.email || "info@restaurant.com",
    address: body.address || "N/A",
    description: body.description || null,
    image_url: body.image_url || null,
    is_open: body.is_open ?? true,
  })

  // Add calling vendor admin as restaurant admin so ownership is bound
  try {
    await (restaurantModule as any).createRestaurantAdmins({
      restaurant_id: restaurant.id,
      first_name: vendorAdmin?.first_name || "Restaurant",
      last_name: vendorAdmin?.last_name || "Manager",
      email: vendorAdmin?.email || body.email,
    })
  } catch (adminErr) {
    console.warn("Could not create restaurant admin link:", adminErr)
  }

  // Link to vendor module via remoteLink
  try {
    await remoteLink.create([
      {
        [MARKETPLACE_MODULE]: { vendor_id: vendorId },
        [RESTAURANT_MODULE]: { restaurant_id: restaurant.id },
      },
    ])
  } catch (linkErr) {
    console.warn("Could not create vendor-restaurant link:", linkErr)
  }

  return res.status(201).json({ restaurant })
}
