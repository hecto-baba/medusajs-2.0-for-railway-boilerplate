import { defineLink } from "@medusajs/framework/utils"
import MarketplaceModule from "../modules/marketplace"
import StockLocationModule from "@medusajs/medusa/stock-location"

/**
 * Links a Vendor to Stock Locations.
 * isList on the stock location side: a vendor can have multiple warehouses/stock locations.
 */
export default defineLink(
  {
    linkable: MarketplaceModule.linkable.vendor,
    deleteCascade: true,
  },
  {
    linkable: StockLocationModule.linkable.stockLocation.id,
    isList: true,
  }
)
