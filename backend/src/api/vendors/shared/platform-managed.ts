import { MedusaError } from "@medusajs/framework/utils"

/**
 * Some configuration belongs to the platform, not to any seller, and is
 * read-only to them: regions (a cart picks ONE region by country) and country
 * tax regions (Medusa allows ONE per country). Sellers may read it; any change
 * answers 403 with a clear message. It is 403, not 404, because the seller can
 * see the resource, so refusing it reveals nothing.
 *
 * Seller-specific tax is modelled as seller-owned tax RATES, not regions
 * (docs/tenant-isolation-and-multi-tenancy.md, Phase 2).
 */
export const platformManaged = (what: string): MedusaError =>
  new MedusaError(
    MedusaError.Types.FORBIDDEN,
    `${what} are managed by the platform and cannot be changed by a seller.`
  )
