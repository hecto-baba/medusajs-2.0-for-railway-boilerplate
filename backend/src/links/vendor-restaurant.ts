import { defineLink } from "@medusajs/framework/utils"
import MarketplaceModule from "../modules/marketplace"
import RestaurantModule from "../modules/restaurant"

/**
 * Links a Vendor to Restaurants.
 * isList on the restaurant side: a vendor can manage one or more restaurants/branches.
 * deleteCascade ensures orphaned link rows are removed when a vendor is deleted.
 */
export default defineLink(
  {
    linkable: MarketplaceModule.linkable.vendor,
    deleteCascade: true,
  },
  {
    linkable: RestaurantModule.linkable.restaurant.id,
    isList: true,
  }
)
