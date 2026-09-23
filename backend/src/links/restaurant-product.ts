import { defineLink } from "@medusajs/framework/utils"
import RestaurantModule from "../modules/restaurant"
import ProductModule from "@medusajs/medusa/product"

export default defineLink(
  RestaurantModule.linkable.restaurant,
  {
    linkable: ProductModule.linkable.product.id,
    isList: true,
  }
)
