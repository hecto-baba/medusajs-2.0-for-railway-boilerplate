import { defineLink } from "@medusajs/framework/utils"
import EoiModule from "../modules/expression-of-interest"
import OrderModule from "@medusajs/medusa/order"

// readOnly, keyed on line_item_id - populated only once the cart completes.
// Mirrors rental-line-item.ts. No separate eoi-cart link: the cart is
// transient, association during cart-life is carried in line-item metadata,
// not a module link - same reasoning rental uses for skipping a rental-cart link.
export default defineLink(
  { linkable: EoiModule.linkable.eoi, field: "line_item_id" },
  OrderModule.linkable.orderLineItem,
  { readOnly: true }
)
