import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  // 1. Fetch vendor base profile, admin accounts, and verified link IDs
  let vendor: any = null
  try {
    const {
      data: [vendorData],
    } = await query.graph({
      entity: "vendor",
      fields: [
        "id",
        "name",
        "handle",
        "logo",
        "created_at",
        "updated_at",
        "admins.*",
        "products.id",
        "venues.id",
        "inventory_items.id",
        "price_lists.id",
        "promotions.id",
        "campaigns.id",
        "collections.id",
        "categories.id",
        "customers.id",
        "customer_groups.id",
        "orders.id",
        "return_reasons.id",
        "refund_reasons.id",
      ],
      filters: { id: [id] },
    })
    vendor = vendorData
  } catch {
    try {
      const {
        data: [vendorData],
      } = await query.graph({
        entity: "vendor",
        fields: [
          "id",
          "name",
          "handle",
          "logo",
          "created_at",
          "updated_at",
          "admins.*",
          "products.id",
          "venues.id",
          "inventory_items.id",
        ],
        filters: { id: [id] },
      })
      vendor = vendorData
    } catch {
      const {
        data: [vendorData],
      } = await query.graph({
        entity: "vendor",
        fields: [
          "id",
          "name",
          "handle",
          "logo",
          "created_at",
          "updated_at",
          "admins.*",
        ],
        filters: { id: [id] },
      })
      vendor = vendorData
    }
  }

  if (!vendor) {
    res.status(404).json({ message: "Vendor not found." })
    return
  }

  const vendorProductIds = (vendor.products || [])
    .map((p: any) => p?.id)
    .filter((pid: any): pid is string => typeof pid === "string" && pid.length > 0)

  // 2. Fetch full Products list for this vendor
  let vendorProducts: any[] = []
  if (vendorProductIds.length > 0) {
    try {
      const { data: fetchedProducts } = await query.graph({
        entity: "product",
        fields: [
          "id",
          "title",
          "handle",
          "thumbnail",
          "status",
          "created_at",
          "updated_at",
          "collection_id",
          "collection.id",
          "collection.title",
          "categories.id",
          "categories.name",
          "variants.id",
          "variants.title",
          "variants.sku",
          "variants.prices.*",
          "options.id",
          "options.title",
          "options.values.*",
          "sales_channels.id",
          "sales_channels.name",
        ],
        filters: { id: vendorProductIds },
      })
      vendorProducts = fetchedProducts || []
    } catch {
      vendorProducts = []
    }
  }

  // 3. Fetch Inventory Items (Direct links + Product Variant links - EXACT same method as seller panel)
  const directInventoryIds = (vendor.inventory_items || [])
    .map((item: any) => item?.id)
    .filter(Boolean)

  const variantInventoryItemIds: string[] = []
  if (vendorProductIds.length > 0) {
    try {
      const { data: prodsWithVariants } = await query.graph({
        entity: "product",
        fields: [
          "id",
          "variants.id",
          "variants.inventory_items.inventory_item_id",
        ],
        filters: { id: vendorProductIds },
      })

      for (const prod of prodsWithVariants || []) {
        for (const variant of prod.variants || []) {
          for (const item of variant.inventory_items || []) {
            if (item?.inventory_item_id) {
              variantInventoryItemIds.push(item.inventory_item_id)
            }
          }
        }
      }
    } catch {
      // Ignore
    }
  }

  const allInventoryItemIds = Array.from(
    new Set([...directInventoryIds, ...variantInventoryItemIds])
  )

  let inventoryItems: any[] = []
  if (allInventoryItemIds.length > 0) {
    try {
      const { data: fetchedInvItems } = await query.graph({
        entity: "inventory_item",
        fields: [
          "id",
          "sku",
          "title",
          "description",
          "requires_shipping",
          "thumbnail",
          "metadata",
          "created_at",
          "updated_at",
          "location_levels.*",
          "location_levels.stock_locations.id",
          "location_levels.stock_locations.name",
        ],
        filters: { id: allInventoryItemIds },
      })

      inventoryItems = (fetchedInvItems || []).map((item: any) => {
        const locationLevels = item.location_levels || []
        const stocked = locationLevels.reduce(
          (sum: number, lvl: any) => sum + (Number(lvl.stocked_quantity) || 0),
          0
        )
        const reserved = locationLevels.reduce(
          (sum: number, lvl: any) => sum + (Number(lvl.reserved_quantity) || 0),
          0
        )
        return {
          ...item,
          stocked_quantity: stocked,
          reserved_quantity: reserved,
          available_quantity: Math.max(0, stocked - reserved),
        }
      })
    } catch {
      inventoryItems = []
    }
  }

  // 4. Fetch Venues (Direct links + Ticket Product links - EXACT same method as seller panel)
  const directVenueIds = (vendor.venues || [])
    .map((v: any) => v?.id)
    .filter(Boolean)

  let ticketProductVenueIds: string[] = []
  if (vendorProductIds.length > 0) {
    try {
      const { data: tpVenues } = await query.graph({
        entity: "ticket_product",
        fields: ["venue_id"],
        filters: { product_id: vendorProductIds },
      })
      ticketProductVenueIds = (tpVenues || [])
        .map((tp: any) => tp.venue_id)
        .filter(Boolean)
    } catch {
      // Ignore
    }
  }

  const allVenueIds = Array.from(
    new Set([...directVenueIds, ...ticketProductVenueIds])
  )

  let venues: any[] = []
  if (allVenueIds.length > 0) {
    try {
      const { data: fetchedVenues } = await query.graph({
        entity: "venue",
        fields: [
          "id",
          "name",
          "address",
          "created_at",
          "updated_at",
          "rows.*",
        ],
        filters: { id: allVenueIds },
      })

      venues = (fetchedVenues || []).map((venue: any) => {
        const rows = venue.rows || []
        const totalSeats = rows.reduce(
          (sum: number, r: any) => sum + (Number(r.seat_count) || 0),
          0
        )
        return {
          ...venue,
          rows_count: rows.length,
          capacity: totalSeats,
          tiers: Array.from(new Set(rows.map((r: any) => r.row_type))),
        }
      })
    } catch {
      venues = []
    }
  }

  // 5. Fetch Shows / Ticket Events
  let shows: any[] = []
  if (vendorProductIds.length > 0) {
    try {
      const { data: ticketProducts } = await query.graph({
        entity: "ticket_product",
        fields: [
          "id",
          "product_id",
          "venue_id",
          "dates",
          "created_at",
          "venue.id",
          "venue.name",
          "venue.rows.*",
          "product.id",
          "product.title",
          "product.thumbnail",
          "product.status",
          "variants.*",
        ],
        filters: { product_id: vendorProductIds },
      })

      shows = (ticketProducts || []).map((tp: any) => {
        const venueRows = tp.venue?.rows || []
        const cap = venueRows.reduce(
          (acc: number, r: any) => acc + (r.seat_count || 0),
          0
        )
        return {
          ...tp,
          title: tp.product?.title || "Ticket Event",
          venue_name: tp.venue?.name || "—",
          venue_capacity: cap,
          dates_count: (tp.dates || []).length,
          tiers_count: (tp.variants || []).length,
        }
      })
    } catch {
      shows = []
    }
  }

  // 6. Fetch Orders (direct links or matching products)
  const directOrderIds = (vendor.orders || [])
    .map((o: any) => o?.id)
    .filter(Boolean)

  let orders: any[] = []
  try {
    if (directOrderIds.length > 0) {
      const { data: matchedOrders } = await query.graph({
        entity: "order",
        fields: [
          "id",
          "display_id",
          "status",
          "payment_status",
          "fulfillment_status",
          "created_at",
          "currency_code",
          "items.id",
          "items.title",
          "items.quantity",
          "items.unit_price",
          "items.thumbnail",
          "items.product_id",
          "items.variant_id",
          "items.variant.id",
          "items.variant.product_id",
          "customer.id",
          "customer.email",
          "customer.first_name",
          "customer.last_name",
          "customer.phone",
        ],
        filters: { id: directOrderIds },
        pagination: { take: 100, order: { created_at: "DESC" } },
      })
      orders = (matchedOrders || []).map((ord: any) => {
        const total = (ord.items || []).reduce((acc: number, item: any) => {
          return acc + (Number(item.unit_price) || 0) * (Number(item.quantity) || 1)
        }, 0)
        return { ...ord, total, subtotal: total }
      })
    } else if (vendorProductIds.length > 0) {
      const vendorProdSet = new Set(vendorProductIds)
      const { data: allOrders } = await query.graph({
        entity: "order",
        fields: [
          "id",
          "display_id",
          "status",
          "payment_status",
          "fulfillment_status",
          "created_at",
          "currency_code",
          "items.id",
          "items.title",
          "items.quantity",
          "items.unit_price",
          "items.thumbnail",
          "items.product_id",
          "items.variant_id",
          "items.variant.id",
          "items.variant.product_id",
          "customer.id",
          "customer.email",
          "customer.first_name",
          "customer.last_name",
          "customer.phone",
        ],
        pagination: { take: 100, order: { created_at: "DESC" } },
      })

      orders = (allOrders || [])
        .map((ord: any) => {
          const vendorItems = (ord.items || []).filter((item: any) => {
            const itemProdId = item?.product_id || item?.variant?.product_id
            return typeof itemProdId === "string" && vendorProdSet.has(itemProdId)
          })

          if (!vendorItems.length) return null

          const vendorSubtotal = vendorItems.reduce((acc: number, item: any) => {
            const unitPrice = Number(item.unit_price) || 0
            const quantity = Number(item.quantity) || 1
            return acc + unitPrice * quantity
          }, 0)

          return {
            ...ord,
            items: vendorItems,
            total: vendorSubtotal,
            subtotal: vendorSubtotal,
          }
        })
        .filter(Boolean)
    }
  } catch {
    orders = []
  }

  // 7. Collections (direct + linked products)
  const directColIds = (vendor.collections || []).map((c: any) => c?.id).filter(Boolean)
  const prodColIds = vendorProducts
    .map((p: any) => p?.collection_id || p?.collection?.id)
    .filter(Boolean)
  const allColIds = Array.from(new Set([...directColIds, ...prodColIds]))

  let collections: any[] = []
  if (allColIds.length > 0) {
    try {
      const { data: fetchedCollections } = await query.graph({
        entity: "product_collection",
        fields: ["id", "title", "handle", "created_at", "updated_at"],
        filters: { id: allColIds },
      })
      collections = (fetchedCollections || []).map((col: any) => ({
        ...col,
        products_count: vendorProducts.filter(
          (p: any) => (p?.collection_id || p?.collection?.id) === col.id
        ).length,
      }))
    } catch {
      collections = []
    }
  }

  // 8. Categories (direct + linked products)
  const directCatIds = (vendor.categories || []).map((c: any) => c?.id).filter(Boolean)
  const prodCatIds: string[] = []
  for (const prod of vendorProducts) {
    for (const cat of prod.categories || []) {
      if (cat?.id) prodCatIds.push(cat.id)
    }
  }
  const allCatIds = Array.from(new Set([...directCatIds, ...prodCatIds]))

  let categories: any[] = []
  if (allCatIds.length > 0) {
    try {
      const { data: fetchedCats } = await query.graph({
        entity: "product_category",
        fields: [
          "id",
          "name",
          "handle",
          "description",
          "is_active",
          "rank",
          "created_at",
        ],
        filters: { id: allCatIds },
      })
      categories = (fetchedCats || []).map((cat: any) => ({
        ...cat,
        products_count: vendorProducts.filter((p: any) =>
          (p.categories || []).some((c: any) => c.id === cat.id)
        ).length,
      }))
    } catch {
      categories = []
    }
  }

  // 9. Product Options (derived cleanly from vendor's product catalog)
  const optionsMap = new Map<string, any>()
  for (const prod of vendorProducts) {
    for (const opt of prod.options || []) {
      if (opt?.id && !optionsMap.has(opt.id)) {
        optionsMap.set(opt.id, {
          ...opt,
          product_title: prod.title,
          values: (opt.values || []).map((v: any) => v.value),
        })
      }
    }
  }
  const productOptions = Array.from(optionsMap.values())

  // 10. Customers & Groups
  const directCustomerIds = (vendor.customers || [])
    .map((c: any) => c?.id)
    .filter(Boolean)

  const customerMap = new Map<string, any>()
  if (directCustomerIds.length > 0) {
    try {
      const { data: fetchedCusts } = await query.graph({
        entity: "customer",
        fields: [
          "id",
          "email",
          "first_name",
          "last_name",
          "phone",
          "company_name",
          "has_account",
          "created_at",
        ],
        filters: { id: directCustomerIds },
      })
      for (const c of fetchedCusts || []) {
        customerMap.set(c.id, { ...c, orders_count: 0 })
      }
    } catch {
      // Ignore
    }
  }

  for (const order of orders) {
    if (order.customer?.id || order.customer?.email) {
      const custKey = order.customer.id || order.customer.email
      if (!customerMap.has(custKey)) {
        customerMap.set(custKey, {
          id: order.customer.id || `cust_${custKey}`,
          email: order.customer.email,
          first_name: order.customer.first_name,
          last_name: order.customer.last_name,
          phone: order.customer.phone,
          created_at: order.created_at,
          orders_count: 1,
        })
      } else {
        const existing = customerMap.get(custKey)
        existing.orders_count = (existing.orders_count || 0) + 1
      }
    }
  }
  const customers = Array.from(customerMap.values())

  // Customer Groups
  const directGroupIds = (vendor.customer_groups || [])
    .map((g: any) => g?.id)
    .filter(Boolean)

  let customerGroups: any[] = []
  if (directGroupIds.length > 0) {
    try {
      const { data: fetchedGroups } = await query.graph({
        entity: "customer_group",
        fields: ["id", "name", "created_at"],
        filters: { id: directGroupIds },
      })
      customerGroups = fetchedGroups || []
    } catch {
      customerGroups = []
    }
  }

  // 11. Price Lists
  const priceListIds = (vendor.price_lists || [])
    .map((pl: any) => pl?.id)
    .filter(Boolean)

  let priceLists: any[] = []
  if (priceListIds.length > 0) {
    try {
      const { data: fetchedPriceLists } = await query.graph({
        entity: "price_list",
        fields: [
          "id",
          "title",
          "description",
          "status",
          "type",
          "starts_at",
          "ends_at",
          "rules",
          "prices.*",
          "created_at",
        ],
        filters: { id: priceListIds },
      })
      priceLists = (fetchedPriceLists || []).map((pl: any) => ({
        ...pl,
        prices_count: pl.prices?.length || 0,
        rules_count: Object.keys(pl.rules || {}).length,
      }))
    } catch {
      priceLists = []
    }
  }

  // 12. Promotions & Campaigns
  const promotionIds = (vendor.promotions || [])
    .map((p: any) => p?.id)
    .filter(Boolean)

  let promotions: any[] = []
  if (promotionIds.length > 0) {
    try {
      const { data: fetchedPromos } = await query.graph({
        entity: "promotion",
        fields: [
          "id",
          "code",
          "type",
          "status",
          "is_automatic",
          "application_method.*",
          "campaign.*",
          "created_at",
        ],
        filters: { id: promotionIds },
      })
      promotions = fetchedPromos || []
    } catch {
      promotions = []
    }
  }

  const campaignIds = (vendor.campaigns || [])
    .map((c: any) => c?.id)
    .filter(Boolean)

  let campaigns: any[] = []
  if (campaignIds.length > 0) {
    try {
      const { data: fetchedCampaigns } = await query.graph({
        entity: "campaign",
        fields: [
          "id",
          "name",
          "description",
          "campaign_identifier",
          "starts_at",
          "ends_at",
          "created_at",
        ],
        filters: { id: campaignIds },
      })
      campaigns = fetchedCampaigns || []
    } catch {
      campaigns = []
    }
  }

  // 13. Settings: Sales Channels (from products), Stock Locations (from inventory levels), Return & Refund Reasons
  const scMap = new Map<string, any>()
  for (const prod of vendorProducts) {
    for (const sc of prod.sales_channels || []) {
      if (sc?.id && !scMap.has(sc.id)) {
        scMap.set(sc.id, {
          id: sc.id,
          name: sc.name,
          description: sc.description || "",
          is_disabled: sc.is_disabled ?? false,
        })
      }
    }
  }
  const salesChannels = Array.from(scMap.values())

  const locMap = new Map<string, any>()
  for (const item of inventoryItems) {
    for (const lvl of item.location_levels || []) {
      if (lvl.stock_locations?.id && !locMap.has(lvl.stock_locations.id)) {
        locMap.set(lvl.stock_locations.id, {
          id: lvl.stock_locations.id,
          name: lvl.stock_locations.name,
          address: lvl.stock_locations.address,
        })
      }
    }
  }
  const stockLocations = Array.from(locMap.values())

  const rrIds = (vendor.return_reasons || []).map((r: any) => r?.id).filter(Boolean)
  let returnReasons: any[] = []
  if (rrIds.length > 0) {
    try {
      const { data: fetchedRr } = await query.graph({
        entity: "return_reason",
        fields: ["id", "label", "value", "description", "created_at"],
        filters: { id: rrIds },
      })
      returnReasons = fetchedRr || []
    } catch {
      returnReasons = []
    }
  }

  const rfIds = (vendor.refund_reasons || []).map((r: any) => r?.id).filter(Boolean)
  let refundReasons: any[] = []
  if (rfIds.length > 0) {
    try {
      const { data: fetchedRf } = await query.graph({
        entity: "refund_reason",
        fields: ["id", "label", "code", "description", "created_at"],
        filters: { id: rfIds },
      })
      refundReasons = fetchedRf || []
    } catch {
      refundReasons = []
    }
  }

  const admins = vendor.admins || []

  // 14. Pre-calculated Summary Metrics
  const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0)
  const totalStocked = inventoryItems.reduce(
    (sum, item) => sum + (Number(item.stocked_quantity) || 0),
    0
  )
  const totalAvailable = inventoryItems.reduce(
    (sum, item) => sum + (Number(item.available_quantity) || 0),
    0
  )

  const metrics = {
    total_products: vendorProducts.length,
    total_orders: orders.length,
    total_revenue: totalRevenue,
    total_inventory_items: inventoryItems.length,
    total_stocked_quantity: totalStocked,
    total_available_quantity: totalAvailable,
    total_customers: customers.length,
    total_customer_groups: customerGroups.length,
    total_collections: collections.length,
    total_categories: categories.length,
    total_price_lists: priceLists.length,
    total_promotions: promotions.length,
    total_campaigns: campaigns.length,
    total_venues: venues.length,
    total_shows: shows.length,
    total_admins: admins.length,
    total_sales_channels: salesChannels.length,
    total_stock_locations: stockLocations.length,
    total_api_keys: 0,
    total_return_reasons: returnReasons.length,
    total_refund_reasons: refundReasons.length,
  }

  res.json({
    vendor: {
      id: vendor.id,
      name: vendor.name,
      handle: vendor.handle,
      logo: vendor.logo,
      created_at: vendor.created_at,
      updated_at: vendor.updated_at,
    },
    admins,
    products: vendorProducts,
    collections,
    categories,
    product_options: productOptions,
    orders,
    inventory_items: inventoryItems,
    customers,
    customer_groups: customerGroups,
    price_lists: priceLists,
    promotions,
    campaigns,
    venues,
    shows,
    sales_channels: salesChannels,
    stock_locations: stockLocations,
    api_keys: [],
    return_reasons: returnReasons,
    refund_reasons: refundReasons,
    metrics,
  })
}
