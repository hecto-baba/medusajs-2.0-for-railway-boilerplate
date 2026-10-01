import { defineLink } from "@medusajs/framework/utils"
import CompanyModule from "../modules/company"
import CartModule from "@medusajs/medusa/cart"

export default defineLink(
  CompanyModule.linkable.company,
  {
    linkable: CartModule.linkable.cart.id,
    isList: true,
  }
)
