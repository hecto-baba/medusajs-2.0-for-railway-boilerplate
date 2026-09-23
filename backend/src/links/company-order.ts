import { defineLink } from "@medusajs/framework/utils"
import CompanyModule from "../modules/company"
import OrderModule from "@medusajs/medusa/order"

export default defineLink(
  CompanyModule.linkable.company,
  {
    linkable: OrderModule.linkable.order.id,
    isList: true,
  }
)
