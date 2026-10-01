import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { getVisibleStockLocations } from "./stock-location-scope"
import { getOwnedIds } from "./vendor-scope"

/**
 * Checks for ids that arrive in inventory request bodies and paths.
 *
 * Ownership of the inventory ITEM is checked by assertVendorOwnsInventoryItem
 * (inventory-items/helpers.ts). These cover the other ids a request can carry.
 */

/**
 * Every stock location named must be the seller's own or a shared platform
 * location. Another seller's location answers 404, so a seller cannot create or
 * change stock levels at (or learn the address of) a location they cannot use.
 */
export const assertVendorCanUseStockLocations = async (
  req: AuthenticatedMedusaRequest,
  locationIds: Array<string | null | undefined>
): Promise<void> => {
  const ids = Array.from(new Set(locationIds.filter((id): id is string => !!id)))

  if (!ids.length) {
    return
  }

  const { owned, platform } = await getVisibleStockLocations(req)
  const visible = new Set([...owned, ...platform])

  if (ids.some((id) => !visible.has(id))) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Stock location not found.")
  }
}

/**
 * A reservation may only name a line item that belongs to one of the seller's
 * own orders. Otherwise a seller could tie stock holds to someone else's order.
 */
export const assertVendorOwnsLineItem = async (
  req: AuthenticatedMedusaRequest,
  lineItemId: string | null | undefined
): Promise<void> => {
  if (!lineItemId) {
    return
  }

  const notFound = new MedusaError(MedusaError.Types.NOT_FOUND, "Line item not found.")
  const orderIds = await getOwnedIds(req, "orders")

  // An empty id list means "no constraint" downstream, so refuse directly.
  if (!orderIds.length) {
    throw notFound
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "items.id"],
    filters: { id: orderIds },
  })

  const found = (orders ?? []).some((order: any) =>
    (order?.items ?? []).some((item: any) => item?.id === lineItemId)
  )

  if (!found) {
    throw notFound
  }
}
