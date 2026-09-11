import { defineLink } from "@medusajs/framework/utils"
import MarketplaceModule from "../modules/marketplace"
import OrderModule from "@medusajs/medusa/order"

/**
 * isList on the order side: a vendor accumulates many orders. Order splitting
 * writes one link per vendor - to the parent order when a cart has a single
 * vendor, or to each child order when it has several.
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
