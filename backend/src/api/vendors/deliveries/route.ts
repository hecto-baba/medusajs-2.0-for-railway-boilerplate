import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const limit = req.query.limit ? parseInt(req.query.limit as string) : 20
  const offset = req.query.offset ? parseInt(req.query.offset as string) : 0
  const status = req.query.status as string | undefined

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["id", "email", "vendor.id"],
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

  // Query deliveries
  try {
    // Ask only for this seller's deliveries. The list used to fetch every delivery and
    // filter afterwards, but the query returns just the first 15 rows by default, so
    // once the system held more than 15 deliveries the newest ones never reached the seller.
    const deliveryIds = new Set<string>()
    if (restaurantIds.length) {
      const { data: restaurants } = await query.graph({
        entity: "restaurant",
        fields: ["id", "deliveries.id"],
        filters: { id: restaurantIds },
      })
      for (const restaurant of restaurants || []) {
        for (const d of (restaurant as any).deliveries || []) {
          if (d?.id) deliveryIds.add(d.id)
        }
      }
    }

    if (!deliveryIds.size) {
      return res.json({ deliveries: [], count: 0, limit, offset })
    }

    const filters: Record<string, any> = { id: [...deliveryIds] }
    if (status) {
      filters.delivery_status = status
    }

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
      filters,
      // Ids are time-ordered, so descending puts the newest order first.
      pagination: { skip: offset, take: limit, order: { id: "DESC" } },
    })

    return res.json({
      deliveries: deliveries || [],
      count: metadata?.count ?? (deliveries || []).length,
      limit,
      offset,
    })
  } catch (graphErr) {
    // Do NOT fall back to listing every delivery: that would show this seller other
    // sellers' deliveries. Say the list is unavailable instead.
    return res.status(500).json({ message: "Could not load deliveries." })
  }
}
