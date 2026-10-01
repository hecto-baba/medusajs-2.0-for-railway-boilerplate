import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { getOwnedIds } from "./vendor-scope"

/**
 * Stock location visibility for sellers.
 *
 * A seller may SEE and USE two kinds of location:
 *   - owned:    linked to this seller (they may also edit and delete these)
 *   - platform: linked to NO seller at all. These are shared, read-only
 *               fulfilment locations (today: the single warehouse every seller
 *               holds stock at). Retiring them is Phase 2.
 * A location owned by ANOTHER seller is never visible or usable: it answers 404.
 */

export type VisibleStockLocations = {
  owned: string[]
  platform: string[]
}

/** Ids of every location that at least one seller owns. */
const getClaimedLocationIds = async (
  req: AuthenticatedMedusaRequest
): Promise<Set<string>> => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: vendors } = await query.graph({
    entity: "vendor",
    fields: ["id", "stock_locations.id"],
  })

  return new Set(
    (vendors ?? []).flatMap((vendor: any) =>
      (vendor?.stock_locations ?? [])
        .map((location: any) => location?.id)
        .filter(Boolean)
    )
  )
}

export const getVisibleStockLocations = async (
  req: AuthenticatedMedusaRequest
): Promise<VisibleStockLocations> => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const owned = await getOwnedIds(req, "stock_locations")
  const claimed = await getClaimedLocationIds(req)

  const { data: all } = await query.graph({
    entity: "stock_location",
    fields: ["id"],
  })

  const platform = (all ?? [])
    .map((location: any) => location?.id as string)
    .filter((id) => !!id && !claimed.has(id))

  return { owned, platform }
}

/** Seller owns the location (required to edit or delete it). */
export const assertVendorOwnsStockLocation = async (
  req: AuthenticatedMedusaRequest,
  locationId: string
): Promise<void> => {
  const owned = await getOwnedIds(req, "stock_locations")

  if (!owned.includes(locationId)) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Stock location not found."
    )
  }
}

/** Seller owns the location or it is a shared platform location (read and use). */
export const assertVendorCanUseStockLocation = async (
  req: AuthenticatedMedusaRequest,
  locationId: string
): Promise<void> => {
  const { owned, platform } = await getVisibleStockLocations(req)

  if (!owned.includes(locationId) && !platform.includes(locationId)) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Stock location not found."
    )
  }
}
