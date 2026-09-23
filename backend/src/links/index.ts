import { defineLink } from "@medusajs/framework/utils"
import RestaurantModule from "../modules/restaurant"
import DeliveryModule from "../modules/delivery"
import ProductModule from "@medusajs/medusa/product"
import CartModule from "@medusajs/medusa/cart"
import OrderModule from "@medusajs/medusa/order"

export const RestaurantProductLink = defineLink(
  RestaurantModule.linkable.restaurant,
  ProductModule.linkable.product
)

export const RestaurantDeliveryLink = defineLink(
  RestaurantModule.linkable.restaurant,
  DeliveryModule.linkable.delivery
)

export const DeliveryCartLink = defineLink(
  DeliveryModule.linkable.delivery,
  CartModule.linkable.cart
)

export const DeliveryOrderLink = defineLink(
  DeliveryModule.linkable.delivery,
  OrderModule.linkable.order
)

export { default as EmployeeCustomerLink } from "./employee-customer"
export { default as CompanyCustomerGroupLink } from "./company-customer-group"
export { default as CompanyCartLink } from "./company-cart"
export { default as CompanyOrderLink } from "./company-order"
export { default as ApprovalCartLink } from "./approval-cart"
export { default as QuoteCartLink } from "./quote-cart"
export { default as QuoteCustomerLink } from "./quote-customer"
export { default as QuoteOrderLink } from "./quote-order"
