import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  assertVendorCanSee,
  getVisibleIds,
  ScopedEntity,
  VisibleIds,
} from "./platform-scope"
import { assertVendorOwns, getOwnedIds } from "./vendor-scope"

/**
 * Stock location visibility for sellers: their own locations, plus a shared PLATFORM
 * location (linked to no seller) ONLY where the seller already holds stock.
 *
 * Phase 1 showed every platform location to every seller, read-only. Since Phase 2
 * each seller has their own location, so a new seller sees none of the platform's.
 * A seller who set up stock at a platform location before that keeps seeing and
 * using that one location until they move the stock; nothing disappears under them.
 */

const STOCK_LOCATIONS: ScopedEntity = {
  linkField: "stock_locations",
  entity: "stock_location",
}

export type VisibleStockLocations = VisibleIds

/** Platform locations (no owner) where the seller has an inventory level. */
const getPlatformLocationsWithOwnStock = async (
  req: AuthenticatedMedusaRequest,
  platformIds: string[]
): Promise<string[]> => {
  if (!platformIds.length) {
    return []
  }
  const ownedItems = await getOwnedIds(req, "inventory_items")
  if (!ownedItems.length) {
    return []
  }
  const query: any = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "inventory_level",
    fields: ["id", "location_id"],
    filters: { inventory_item_id: ownedItems, location_id: platformIds },
  })
  return [...new Set<string>((data ?? []).map((level: any) => level.location_id as string))]
}

export const getVisibleStockLocations = async (
  req: AuthenticatedMedusaRequest
): Promise<VisibleStockLocations> => {
  const { owned, platform } = await getVisibleIds(req, STOCK_LOCATIONS)
  return { owned, platform: await getPlatformLocationsWithOwnStock(req, platform) }
}

/** Seller owns the location (required to edit or delete it). */
export const assertVendorOwnsStockLocation = (
  req: AuthenticatedMedusaRequest,
  locationId: string
): Promise<void> =>
  assertVendorOwns(req, "stock_locations", locationId, "Stock location not found.")

/** Seller owns the location, or holds stock at that platform location (read and use). */
export const assertVendorCanUseStockLocation = async (
  req: AuthenticatedMedusaRequest,
  locationId: string
): Promise<void> => {
  const { owned, platform } = await getVisibleStockLocations(req)
  if (![...owned, ...platform].includes(locationId)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Stock location not found.")
  }
}
