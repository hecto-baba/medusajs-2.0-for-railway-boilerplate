import { defineLink } from "@medusajs/framework/utils"
import RestaurantModule from "../modules/restaurant"
import DeliveryModule from "../modules/delivery"

export default defineLink(
  RestaurantModule.linkable.restaurant,
  {
    linkable: DeliveryModule.linkable.delivery.id,
    isList: true,
  }
)
