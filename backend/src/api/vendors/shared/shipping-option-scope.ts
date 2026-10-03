import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { getOwnedIds } from "./vendor-scope"

/**
 * Shipping options belong to a seller through the chain
 *   seller -> stock location -> fulfilment set -> service zone -> shipping option
 * (Phase 2 step 1 gives every seller location its own set and zone). No separate
 * link table: whoever owns the location owns everything under it, so an option
 * can never be attached to a zone the seller does not own.
 *
 * Rule 2 of vendor-scope.ts applies: an empty owned list means "match nothing".
 */

export type OwnedShippingZone = {
  id: string
  stock_location_id: string
  provider_ids: string[]
}

export type OwnedShippingScope = {
  zones: OwnedShippingZone[]
  optionIds: string[]
}

/** Zones and options under the calling seller's own stock locations. */
export const getOwnedShippingScope = async (
  req: AuthenticatedMedusaRequest
): Promise<OwnedShippingScope> => {
  const locationIds = await getOwnedIds(req, "stock_locations")

  if (!locationIds.length) {
    return { zones: [], optionIds: [] }
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: [
      "id",
      "fulfillment_providers.id",
      "fulfillment_sets.service_zones.id",
      "fulfillment_sets.service_zones.shipping_options.id",
    ],
    filters: { id: locationIds },
  })

  const zones: OwnedShippingZone[] = []
  const optionIds: string[] = []

  for (const location of (locations ?? []) as any[]) {
    const providerIds = (location.fulfillment_providers ?? []).map((p: any) => p.id)
    for (const set of location.fulfillment_sets ?? []) {
      for (const zone of set?.service_zones ?? []) {
        zones.push({ id: zone.id, stock_location_id: location.id, provider_ids: providerIds })
        for (const option of zone?.shipping_options ?? []) {
          optionIds.push(option.id)
        }
      }
    }
  }

  return { zones, optionIds }
}

export const getOwnedShippingOptionIds = async (
  req: AuthenticatedMedusaRequest
): Promise<string[]> => (await getOwnedShippingScope(req)).optionIds

/** The shipping option is under one of the seller's own locations; 404 otherwise. */
export const assertVendorOwnsShippingOption = async (
  req: AuthenticatedMedusaRequest,
  optionId: string
): Promise<void> => {
  const { optionIds } = await getOwnedShippingScope(req)

  if (!optionIds.includes(optionId)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Shipping option not found.")
  }
}

/** Returns the seller's own zone (with its location's providers); 404 otherwise. */
export const assertVendorOwnsServiceZone = async (
  req: AuthenticatedMedusaRequest,
  zoneId: string
): Promise<OwnedShippingZone> => {
  const { zones } = await getOwnedShippingScope(req)
  const zone = zones.find((z) => z.id === zoneId)

  if (!zone) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Service zone not found.")
  }

  return zone
}
