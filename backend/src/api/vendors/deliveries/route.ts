import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { DELIVERY_MODULE } from "../../../modules/delivery"
import DeliveryModuleService from "../../../modules/delivery/service"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const deliveryModule: DeliveryModuleService = req.scope.resolve(DELIVERY_MODULE)

  const limit = req.query.limit ? parseInt(req.query.limit as string) : 20
  const offset = req.query.offset ? parseInt(req.query.offset as string) : 0
  const status = req.query.status as string | undefined

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["id", "email", "vendor.id", "vendor.orders.id"],
    filters: { id: [req.auth_context.actor_id] },
  })

  if (!vendorAdmin) {
    return res.status(401).json({ message: "Vendor not authenticated" })
  }

  // 1. Get vendor's restaurants
  const restaurantIds: string[] = []
  try {
    const { data: adminRestaurants } = await query.graph({
      entity: "restaurant",
      fields: ["id"],
      filters: {
        admins: { email: vendorAdmin.email },
      },
    })
    for (const r of adminRestaurants || []) {
      if (r?.id && !restaurantIds.includes(r.id)) {
        restaurantIds.push(r.id)
      }
    }
  } catch {}

  try {
    const { data: [vendor] } = await query.graph({
      entity: "vendor",
      fields: ["id", "restaurants.id"],
      filters: { id: [vendorAdmin.vendor.id] },
    })
    for (const r of vendor?.restaurants || []) {
      if (r?.id && !restaurantIds.includes(r.id)) {
        restaurantIds.push(r.id)
      }
    }
  } catch {}

  const vendorOrderIds = (vendorAdmin.vendor?.orders || []).map((o: any) => o.id).filter(Boolean)

  // Query deliveries
  try {
    const { data: deliveries, metadata } = await query.graph({
      entity: "delivery",
      fields: [
        "id",
        "transaction_id",
        "delivery_status",
        "eta",
        "delivered_at",
        "driver.*",
        "restaurant.*",
        "order.*",
        "order.display_id",
        "order.total",
        "order.currency_code",
        "order.items.*",
      ],
    })

    // Filter deliveries belonging to vendor's restaurant or vendor's order
    let scopedDeliveries = (deliveries || []).filter((d: any) => {
      if (d.restaurant?.id && restaurantIds.includes(d.restaurant.id)) {
        return true
      }
      if (d.order?.id && vendorOrderIds.includes(d.order.id)) {
        return true
      }
      return false
    })

    if (status) {
      scopedDeliveries = scopedDeliveries.filter((d: any) => d.delivery_status === status)
    }

    return res.json({
      deliveries: scopedDeliveries.slice(offset, offset + limit),
      count: scopedDeliveries.length,
      limit,
      offset,
    })
  } catch (graphErr) {
    // Fallback using delivery module
    const filters: Record<string, any> = {}
    if (status) filters.delivery_status = status
    const [deliveries, count] = await deliveryModule.listAndCountDeliveries(filters, {
      take: limit,
      skip: offset,
      relations: ["driver"],
    })
    return res.json({ deliveries, count, limit, offset })
  }
}
