import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"

export const VENDOR_SHOW_FIELDS = [
  "id",
  "product_id",
  "venue_id",
  "dates",
  "created_at",
  "updated_at",
  "venue.*",
  "venue.rows.*",
  "variants.*",
  "product.*",
  "product.thumbnail",
  "product.title",
  "product.status",
]

/**
 * Returns all show (TicketProduct) IDs that belong to the calling vendor.
 */
export const getVendorShowIds = async (
  req: AuthenticatedMedusaRequest
): Promise<string[]> => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [vendorAdmin],
  } = await query.graph({
    entity: "vendor_admin",
    fields: ["vendor.id", "vendor.products.id"],
    filters: { id: [req.auth_context.actor_id] },
  })

  if (!vendorAdmin?.vendor) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No vendor found for the authenticated session."
    )
  }

  const productIds = (
    (vendorAdmin.vendor as any).products as { id?: string }[] | undefined
  )
    ?.map((p) => p?.id)
    .filter((id): id is string => !!id) ?? []

  if (!productIds.length) {
    return []
  }

  const { data: ticketProducts } = await query.graph({
    entity: "ticket_product",
    fields: ["id"],
    filters: { product_id: productIds },
  })

  return ticketProducts.map((tp: any) => tp.id)
}

/**
 * Confirms the calling vendor owns the show.
 */
export const assertVendorOwnsShow = async (
  req: AuthenticatedMedusaRequest,
  showId: string,
  notFoundMessage = "Show not found."
): Promise<void> => {
  const ownedIds = await getVendorShowIds(req)

  if (!ownedIds.includes(showId)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, notFoundMessage)
  }
}

/**
 * Helper to transform show details with formatted date span, tiers list, and summary.
 */
export const transformVendorShow = (show: any) => {
  const tiers = Array.from(
    new Set((show.variants || []).map((v: any) => v.row_type))
  )

  const venueRows = show.venue?.rows || []
  const totalVenueCapacity = venueRows.reduce(
    (acc: number, r: any) => acc + (r.seat_count || 0),
    0
  )

  return {
    ...show,
    tiers,
    venue_capacity: totalVenueCapacity,
    dates_count: show.dates?.length ?? 0,
  }
}
