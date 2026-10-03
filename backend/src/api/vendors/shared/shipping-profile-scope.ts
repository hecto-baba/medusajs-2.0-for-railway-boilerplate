import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { assertVendorCanSee, ScopedEntity } from "./platform-scope"

/**
 * A product's shipping profile must be one the seller may use: their own, or a
 * shared platform profile. Another seller's profile answers 404, so a seller
 * cannot attach someone else's profile to their product (which would also make
 * that profile impossible for the other seller to change or delete safely).
 */

const SHIPPING_PROFILES: ScopedEntity = {
  linkField: "shipping_profiles",
  entity: "shipping_profile",
}

export const assertVendorCanUseShippingProfile = (
  req: AuthenticatedMedusaRequest,
  profileId: string
): Promise<void> =>
  assertVendorCanSee(req, SHIPPING_PROFILES, profileId, "Shipping profile not found.")

/** Checks every profile id found in a product body; empty or missing ids are skipped. */
export const assertVendorCanUseShippingProfiles = async (
  req: AuthenticatedMedusaRequest,
  profileIds: Array<string | null | undefined>
): Promise<void> => {
  for (const profileId of new Set(profileIds.filter((id): id is string => !!id))) {
    await assertVendorCanUseShippingProfile(req, profileId)
  }
}
