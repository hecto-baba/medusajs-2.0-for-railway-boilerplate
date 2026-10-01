import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import {
  assertVendorCanSee,
  getVisibleIds,
  ScopedEntity,
  VisibleIds,
} from "./platform-scope"
import { assertVendorOwns } from "./vendor-scope"

/**
 * Stock location visibility for sellers: their own locations plus shared
 * platform locations (linked to no seller). See platform-scope.ts.
 */

const STOCK_LOCATIONS: ScopedEntity = {
  linkField: "stock_locations",
  entity: "stock_location",
}

export type VisibleStockLocations = VisibleIds

export const getVisibleStockLocations = (
  req: AuthenticatedMedusaRequest
): Promise<VisibleStockLocations> => getVisibleIds(req, STOCK_LOCATIONS)

/** Seller owns the location (required to edit or delete it). */
export const assertVendorOwnsStockLocation = (
  req: AuthenticatedMedusaRequest,
  locationId: string
): Promise<void> =>
  assertVendorOwns(req, "stock_locations", locationId, "Stock location not found.")

/** Seller owns the location or it is a shared platform location (read and use). */
export const assertVendorCanUseStockLocation = (
  req: AuthenticatedMedusaRequest,
  locationId: string
): Promise<void> =>
  assertVendorCanSee(req, STOCK_LOCATIONS, locationId, "Stock location not found.")
