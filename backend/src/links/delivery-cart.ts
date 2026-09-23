import { defineLink } from "@medusajs/framework/utils"
import DeliveryModule from "../modules/delivery"
import CartModule from "@medusajs/medusa/cart"

export default defineLink(
  DeliveryModule.linkable.delivery,
  CartModule.linkable.cart
)
