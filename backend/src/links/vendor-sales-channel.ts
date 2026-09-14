import { defineLink } from "@medusajs/framework/utils"
import MarketplaceModule from "../modules/marketplace"
import SalesChannelModule from "@medusajs/medusa/sales-channel"

/**
 * Links a Vendor to Sales Channels.
 * isList on the sales channel side: a vendor can be assigned to multiple sales channels.
 */
export default defineLink(
  {
    linkable: MarketplaceModule.linkable.vendor,
    deleteCascade: true,
  },
  {
    linkable: SalesChannelModule.linkable.salesChannel.id,
    isList: true,
  }
)
