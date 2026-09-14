import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"

export const VENDOR_VENUE_FIELDS = [
  "id",
  "name",
  "address",
  "created_at",
  "updated_at",
  "rows.*",
]

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
 * Returns all venue IDs that belong to the calling vendor.
 */
export const getVendorVenueIds = async (
  req: AuthenticatedMedusaRequest
): Promise<string[]> => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["vendor.id", "vendor.venues.id"],
    filters: { id: [req.auth_context.actor_id] },
  })

  if (!vendorAdmin?.vendor) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No vendor found for the authenticated session."
    )
  }

  return (
    (vendorAdmin.vendor as any).venues as { id?: string }[] | undefined
  )
    ?.map((v) => v?.id)
    .filter((id): id is string => !!id) ?? []
}

/**
 * Confirms the calling vendor owns the venue.
 */
export const assertVendorOwnsVenue = async (
  req: AuthenticatedMedusaRequest,
  venueId: string,
  notFoundMessage = "Venue not found."
): Promise<void> => {
  const ownedIds = await getVendorVenueIds(req)

  if (!ownedIds.includes(venueId)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, notFoundMessage)
  }
}

/**
 * Helper to transform venue with total seats and tiers breakdown.
 */
export const transformVendorVenue = (venue: any) => {
  const rows = venue.rows || []
  const totalSeats = rows.reduce(
    (total: number, row: any) => total + (row.seat_count || 0),
    0
  )
  const tiers = Array.from(new Set(rows.map((row: any) => row.row_type)))

  return {
    ...venue,
    rows_count: rows.length,
    total_seats: totalSeats,
    tiers,
  }
}
