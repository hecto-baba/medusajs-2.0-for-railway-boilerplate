import { defineLink } from "@medusajs/framework/utils"
import MarketplaceModule from "../modules/marketplace"
import OrderModule from "@medusajs/medusa/order"

/**
 * isList: a vendor defines many return reasons (Wrong size, Damaged, ...).
 * deleteCascade on the vendor side only - the reasons themselves belong to the
 * Order module and outlive the link, same rationale as vendor-product.ts.
 *
 * ReturnReason has no dedicated module of its own; it is a model inside the
 * Order module (see @medusajs/order's joiner-config.js), and Medusa derives
 * its linkable key from the model name automatically - confirmed by
 * inspecting OrderModule.linkable at runtime rather than assumed, since
 * ReturnReason does not appear in the module's explicit `linkableKeys` map
 * (only claim_id and exchange_id do).
 */
export default defineLink(
  { linkable: MarketplaceModule.linkable.vendor, deleteCascade: true },
  { linkable: OrderModule.linkable.returnReason.id, isList: true }
)
