import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"

export const GetVendorSearchSchema = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(3),
  entity: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) =>
      val === undefined ? undefined : Array.isArray(val) ? val : [val]
    ),
})

type SearchResultGroup = {
  entity: string
  count: number
  data: any[]
}

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { q, limit, entity } = (req.validatedQuery ?? {}) as z.infer<
    typeof GetVendorSearchSchema
  >

  if (!q || !q.trim()) {
    res.json({ results: [] })
    return
  }

  const searchTerm = q.trim().toLowerCase()
  const entitiesToSearch = entity && entity.length > 0 ? new Set(entity) : null

  const shouldSearch = (name: string) =>
    !entitiesToSearch || entitiesToSearch.has(name)

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: [
      "vendor.id",
      "vendor.products.id",
      "vendor.products.title",
      "vendor.products.handle",
      "vendor.products.thumbnail",
      "vendor.products.variants.id",
      "vendor.products.variants.title",
      "vendor.products.variants.sku",
      "vendor.orders.id",
      "vendor.orders.display_id",
      "vendor.orders.email",
      "vendor.price_lists.id",
      "vendor.price_lists.title",
      "vendor.price_lists.description",
      "vendor.promotions.id",
      "vendor.promotions.code",
      "vendor.campaigns.id",
      "vendor.campaigns.name",
      "vendor.stock_locations.id",
      "vendor.stock_locations.name",
      "vendor.return_reasons.id",
      "vendor.return_reasons.label",
      "vendor.return_reasons.value",
      "vendor.refund_reasons.id",
      "vendor.refund_reasons.label",
      "vendor.refund_reasons.value",
      "vendor.venues.id",
      "vendor.venues.name",
      "vendor.shows.id",
      "vendor.shows.title",
    ],
    filters: { id: [req.auth_context.actor_id] },
  })

  if (!vendorAdmin?.vendor) {
    res.status(404).json({ message: "Vendor not found" })
    return
  }

  const vendor = vendorAdmin.vendor
  const results: SearchResultGroup[] = []

  // 1. Orders
  if (shouldSearch("order")) {
    const orders = (vendor.orders ?? []).filter((order: any) => {
      if (!order) return false
      const displayId = String(order.display_id ?? "").toLowerCase()
      const email = String(order.email ?? "").toLowerCase()
      const id = String(order.id ?? "").toLowerCase()
      return (
        displayId.includes(searchTerm) ||
        email.includes(searchTerm) ||
        id.includes(searchTerm) ||
        `#${displayId}`.includes(searchTerm)
      )
    })

    if (orders.length > 0) {
      results.push({
        entity: "order",
        count: orders.length,
        data: orders.slice(0, limit),
      })
    }
  }

  // 2. Products
  if (shouldSearch("product")) {
    const products = (vendor.products ?? []).filter((product: any) => {
      if (!product) return false
      const title = String(product.title ?? "").toLowerCase()
      const handle = String(product.handle ?? "").toLowerCase()
      return title.includes(searchTerm) || handle.includes(searchTerm)
    })

    if (products.length > 0) {
      results.push({
        entity: "product",
        count: products.length,
        data: products.slice(0, limit),
      })
    }
  }

  // 3. Product Variants
  if (shouldSearch("productVariant")) {
    const variants: any[] = []
    ;(vendor.products ?? []).forEach((p: any) => {
      ;(p?.variants ?? []).forEach((v: any) => {
        if (!v) return
        const title = String(v.title ?? "").toLowerCase()
        const sku = String(v.sku ?? "").toLowerCase()
        if (title.includes(searchTerm) || sku.includes(searchTerm)) {
          variants.push({
            ...v,
            product_id: p.id,
          })
        }
      })
    })

    if (variants.length > 0) {
      results.push({
        entity: "productVariant",
        count: variants.length,
        data: variants.slice(0, limit),
      })
    }
  }

  // 4. Customers
  if (shouldSearch("customer")) {
    try {
      const { data: customers } = await query.graph({
        entity: "customer",
        fields: ["id", "first_name", "last_name", "email", "phone"],
        filters: {},
      })

      const matchedCustomers = (customers ?? []).filter((c: any) => {
        if (!c) return false
        const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.toLowerCase()
        const email = String(c.email ?? "").toLowerCase()
        const phone = String(c.phone ?? "").toLowerCase()
        return (
          name.includes(searchTerm) ||
          email.includes(searchTerm) ||
          phone.includes(searchTerm)
        )
      })

      if (matchedCustomers.length > 0) {
        results.push({
          entity: "customer",
          count: matchedCustomers.length,
          data: matchedCustomers.slice(0, limit),
        })
      }
    } catch {
      // ignore
    }
  }

  // 5. Customer Groups
  if (shouldSearch("customerGroup")) {
    try {
      const { data: customerGroups } = await query.graph({
        entity: "customer_group",
        fields: ["id", "name"],
        filters: {},
      })

      const matchedGroups = (customerGroups ?? []).filter((g: any) => {
        if (!g) return false
        const name = String(g.name ?? "").toLowerCase()
        return name.includes(searchTerm)
      })

      if (matchedGroups.length > 0) {
        results.push({
          entity: "customerGroup",
          count: matchedGroups.length,
          data: matchedGroups.slice(0, limit),
        })
      }
    } catch {
      // ignore
    }
  }

  // 6. Price Lists
  if (shouldSearch("priceList")) {
    const priceLists = (vendor.price_lists ?? []).filter((pl: any) => {
      if (!pl) return false
      const title = String(pl.title ?? "").toLowerCase()
      const desc = String(pl.description ?? "").toLowerCase()
      return title.includes(searchTerm) || desc.includes(searchTerm)
    })

    if (priceLists.length > 0) {
      results.push({
        entity: "priceList",
        count: priceLists.length,
        data: priceLists.slice(0, limit),
      })
    }
  }

  // 7. Promotions
  if (shouldSearch("promotion")) {
    const promotions = (vendor.promotions ?? []).filter((p: any) => {
      if (!p) return false
      const code = String(p.code ?? "").toLowerCase()
      return code.includes(searchTerm)
    })

    if (promotions.length > 0) {
      results.push({
        entity: "promotion",
        count: promotions.length,
        data: promotions.slice(0, limit),
      })
    }
  }

  // 8. Campaigns
  if (shouldSearch("campaign")) {
    const campaigns = (vendor.campaigns ?? []).filter((c: any) => {
      if (!c) return false
      const name = String(c.name ?? "").toLowerCase()
      return name.includes(searchTerm)
    })

    if (campaigns.length > 0) {
      results.push({
        entity: "campaign",
        count: campaigns.length,
        data: campaigns.slice(0, limit),
      })
    }
  }

  // 9. Collections
  if (shouldSearch("collection")) {
    try {
      const { data: collections } = await query.graph({
        entity: "product_collection",
        fields: ["id", "title", "handle"],
        filters: {},
      })

      const matched = (collections ?? []).filter((c: any) => {
        if (!c) return false
        const title = String(c.title ?? "").toLowerCase()
        const handle = String(c.handle ?? "").toLowerCase()
        return title.includes(searchTerm) || handle.includes(searchTerm)
      })

      if (matched.length > 0) {
        results.push({
          entity: "collection",
          count: matched.length,
          data: matched.slice(0, limit),
        })
      }
    } catch {
      // ignore
    }
  }

  // 10. Categories
  if (shouldSearch("category")) {
    try {
      const { data: categories } = await query.graph({
        entity: "product_category",
        fields: ["id", "name", "handle"],
        filters: {},
      })

      const matched = (categories ?? []).filter((c: any) => {
        if (!c) return false
        const name = String(c.name ?? "").toLowerCase()
        const handle = String(c.handle ?? "").toLowerCase()
        return name.includes(searchTerm) || handle.includes(searchTerm)
      })

      if (matched.length > 0) {
        results.push({
          entity: "category",
          count: matched.length,
          data: matched.slice(0, limit),
        })
      }
    } catch {
      // ignore
    }
  }

  // 11. Inventory
  if (shouldSearch("inventory")) {
    try {
      const { data: inventoryItems } = await query.graph({
        entity: "inventory_item",
        fields: ["id", "title", "sku"],
        filters: {},
      })

      const matched = (inventoryItems ?? []).filter((i: any) => {
        if (!i) return false
        const title = String(i.title ?? "").toLowerCase()
        const sku = String(i.sku ?? "").toLowerCase()
        return title.includes(searchTerm) || sku.includes(searchTerm)
      })

      if (matched.length > 0) {
        results.push({
          entity: "inventory",
          count: matched.length,
          data: matched.slice(0, limit),
        })
      }
    } catch {
      // ignore
    }
  }

  // 12. Venues
  if (shouldSearch("venue")) {
    const venues = (vendor.venues ?? []).filter((v: any) => {
      if (!v) return false
      const name = String(v.name ?? "").toLowerCase()
      return name.includes(searchTerm)
    })

    if (venues.length > 0) {
      results.push({
        entity: "venue",
        count: venues.length,
        data: venues.slice(0, limit),
      })
    }
  }

  // 13. Shows
  if (shouldSearch("show")) {
    const shows = (vendor.shows ?? []).filter((s: any) => {
      if (!s) return false
      const title = String(s.title ?? "").toLowerCase()
      return title.includes(searchTerm)
    })

    if (shows.length > 0) {
      results.push({
        entity: "show",
        count: shows.length,
        data: shows.slice(0, limit),
      })
    }
  }

  // 14. Locations
  if (shouldSearch("location")) {
    const locations = (vendor.stock_locations ?? []).filter((l: any) => {
      if (!l) return false
      const name = String(l.name ?? "").toLowerCase()
      return name.includes(searchTerm)
    })

    if (locations.length > 0) {
      results.push({
        entity: "location",
        count: locations.length,
        data: locations.slice(0, limit),
      })
    }
  }

  // 15. Return Reasons
  if (shouldSearch("returnReason")) {
    const returnReasons = (vendor.return_reasons ?? []).filter((r: any) => {
      if (!r) return false
      const label = String(r.label ?? "").toLowerCase()
      const value = String(r.value ?? "").toLowerCase()
      return label.includes(searchTerm) || value.includes(searchTerm)
    })

    if (returnReasons.length > 0) {
      results.push({
        entity: "returnReason",
        count: returnReasons.length,
        data: returnReasons.slice(0, limit),
      })
    }
  }

  // 16. Refund Reasons
  if (shouldSearch("refundReason")) {
    const refundReasons = (vendor.refund_reasons ?? []).filter((r: any) => {
      if (!r) return false
      const label = String(r.label ?? "").toLowerCase()
      const value = String(r.value ?? "").toLowerCase()
      return label.includes(searchTerm) || value.includes(searchTerm)
    })

    if (refundReasons.length > 0) {
      results.push({
        entity: "refundReason",
        count: refundReasons.length,
        data: refundReasons.slice(0, limit),
      })
    }
  }

  res.json({ results })
}
