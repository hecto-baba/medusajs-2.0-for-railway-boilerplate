import { defineLink } from "@medusajs/framework/utils"
import DeliveryModule from "../modules/delivery"
import OrderModule from "@medusajs/medusa/order"

export default defineLink(
  DeliveryModule.linkable.delivery,
  OrderModule.linkable.order
)
