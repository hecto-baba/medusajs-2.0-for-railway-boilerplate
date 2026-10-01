import { defineLink } from "@medusajs/framework/utils"
import MarketplaceModule from "../modules/marketplace"
import OrderModule from "@medusajs/medusa/order"

/**
 * isList on the order side: a vendor accumulates many orders.
 *
 * Today there is NO order splitting: one cart produces one order, and the
 * `link-vendor-order` subscriber links every vendor owning an item in it to
 * that same order. Splitting into per-vendor child orders is planned (see
 * docs/tenant-isolation-and-multi-tenancy.md, Phase 3).
 */
export default defineLink(
  {
    linkable: MarketplaceModule.linkable.vendor,
    deleteCascade: true,
  },
  {
    linkable: OrderModule.linkable.order.id,
    isList: true,
  }
)
