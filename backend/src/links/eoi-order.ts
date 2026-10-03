import { defineLink } from "@medusajs/framework/utils"
import EoiModule from "../modules/expression-of-interest"
import OrderModule from "@medusajs/medusa/order"

// readOnly, keyed on order_id - populated only once the cart completes.
// Mirrors rental-order.ts.
export default defineLink(
  { linkable: EoiModule.linkable.eoi, field: "order_id" },
  OrderModule.linkable.order,
  { readOnly: true }
)
