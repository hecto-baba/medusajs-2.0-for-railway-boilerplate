import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"

/**
 * Returns the vendor id behind the calling admin.
 */
export const getVendorId = async (
  req: AuthenticatedMedusaRequest
): Promise<string> => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["vendor.id"],
    filters: { id: [req.auth_context.actor_id] },
  })

  const vendorId = vendorAdmin?.vendor?.id

  if (!vendorId) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No vendor found for the authenticated session."
    )
  }

  return vendorId
}

/**
 * Returns all inventory item ids that belong to the calling vendor:
 * 1. Direct links via `vendor.inventory_items`
 * 2. Variant links via `vendor.products.variants.inventory_items`
 */
export const getVendorInventoryItemIds = async (
  req: AuthenticatedMedusaRequest
): Promise<string[]> => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: [
      "vendor.id",
      "vendor.inventory_items.id",
      "vendor.products.id",
    ],
    filters: { id: [req.auth_context.actor_id] },
  })

  if (!vendorAdmin?.vendor) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No vendor found for the authenticated session."
    )
  }

  const directIds = (
    (vendorAdmin.vendor as any).inventory_items as { id?: string }[] | undefined
  )
    ?.map((item) => item?.id)
    .filter((id): id is string => !!id) ?? []

  const productIds = (
    (vendorAdmin.vendor as any).products as { id?: string }[] | undefined
  )
    ?.map((p) => p?.id)
    .filter((id): id is string => !!id) ?? []

  const variantItemIds: string[] = []

  if (productIds.length) {
    const { data: products } = await query.graph({
      entity: "product",
      fields: ["id", "variants.id", "variants.inventory_items.inventory_item_id"],
      filters: { id: productIds },
    })

    for (const product of products ?? []) {
      for (const variant of (product as any).variants ?? []) {
        for (const item of (variant as any).inventory_items ?? []) {
          if (item?.inventory_item_id) {
            variantItemIds.push(item.inventory_item_id)
          }
        }
      }
    }
  }

  return Array.from(new Set([...directIds, ...variantItemIds]))
}

/**
 * Confirms the calling vendor owns the inventory item.
 */
export const assertVendorOwnsInventoryItem = async (
  req: AuthenticatedMedusaRequest,
  inventoryItemId: string,
  notFoundMessage = "Inventory item not found."
): Promise<void> => {
  const ownedIds = await getVendorInventoryItemIds(req)

  if (!ownedIds.includes(inventoryItemId)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, notFoundMessage)
  }
}

/**
 * Confirms the calling vendor owns every inventory item in the list.
 */
export const assertVendorOwnsAllInventoryItems = async (
  req: AuthenticatedMedusaRequest,
  inventoryItemIds: string[],
  notFoundMessage = "One or more inventory items were not found."
): Promise<void> => {
  const ids = inventoryItemIds.filter(Boolean)

  if (!ids.length) {
    return
  }

  const ownedIds = await getVendorInventoryItemIds(req)
  const ownedSet = new Set(ownedIds)

  if (!ids.every((id) => ownedSet.has(id))) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, notFoundMessage)
  }
}

/** Fields returned for inventory item list view in vendor panel. */
export const VENDOR_INVENTORY_ITEM_FIELDS = [
  "id",
  "sku",
  "title",
  "description",
  "hs_code",
  "mid_code",
  "origin_country",
  "material",
  "weight",
  "length",
  "height",
  "width",
  "requires_shipping",
  "thumbnail",
  "metadata",
  "created_at",
  "updated_at",
  "stocked_quantity",
  "reserved_quantity",
  "location_levels.*",
  "location_levels.stock_locations.id",
  "location_levels.stock_locations.name",
]

/** Fields returned for inventory item detail view in vendor panel. */
export const VENDOR_INVENTORY_DETAIL_FIELDS = [
  "id",
  "sku",
  "title",
  "description",
  "hs_code",
  "mid_code",
  "origin_country",
  "material",
  "weight",
  "length",
  "height",
  "width",
  "requires_shipping",
  "thumbnail",
  "metadata",
  "created_at",
  "updated_at",
  "stocked_quantity",
  "reserved_quantity",
  "location_levels.*",
  "location_levels.stock_locations.id",
  "location_levels.stock_locations.name",
  "location_levels.stock_locations.address.*",
  "variants.id",
  "variants.title",
  "variants.sku",
  "variants.product.id",
  "variants.product.title",
  "variants.product.thumbnail",
  "variants.options.*",
]

/**
 * Refetches an inventory item with all specified fields.
 */
export const refetchVendorInventoryItem = async (
  id: string,
  scope: any,
  fields: string[] = VENDOR_INVENTORY_DETAIL_FIELDS
) => {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [inventoryItem],
  } = await query.graph({
    entity: "inventory_item",
    fields,
    filters: { id: [id] },
  })

  if (!inventoryItem) {
    return null
  }

  const totalStocked = (inventoryItem.location_levels ?? []).reduce(
    (sum: number, lvl: any) => sum + (Number(lvl.stocked_quantity) || 0),
    0
  )
  const totalReserved = (inventoryItem.location_levels ?? []).reduce(
    (sum: number, lvl: any) => sum + (Number(lvl.reserved_quantity) || 0),
    0
  )

  return {
    ...inventoryItem,
    stocked_quantity: totalStocked,
    reserved_quantity: totalReserved,
  }
}
