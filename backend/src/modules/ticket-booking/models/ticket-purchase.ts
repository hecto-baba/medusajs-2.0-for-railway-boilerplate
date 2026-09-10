import { model } from "@medusajs/framework/utils"
import { TicketProduct } from "./ticket-product"
import { TicketProductVariant } from "./ticket-product-variant"
import { VenueRow } from "./venue-row"

/**
 * One physical seat sold for one show date. Created only once the cart has
 * been completed, which is also what makes a seat show as taken to everyone
 * else - see the seats API route.
 */
export const TicketPurchase = model.define("ticket_purchase", {
  id: model.id().primaryKey(),
  order_id: model.text(),
  ticket_product: model.belongsTo(() => TicketProduct, {
    mappedBy: "purchases",
  }),
  ticket_variant: model.belongsTo(() => TicketProductVariant, {
    mappedBy: "purchases",
  }),
  venue_row: model.belongsTo(() => VenueRow),
  seat_number: model.text(),
  show_date: model.dateTime(),
  status: model.enum(["pending", "scanned"]).default("pending"),
})
.indexes([
  {
    on: ["order_id"],
  },
  // The last line of defence against double-booking. The add-to-cart hook and
  // the order validation step both check for a taken seat first, but neither
  // holds a lock across the gap between checking and writing; this constraint
  // does, so two shoppers racing for the same seat cannot both be persisted.
  {
    on: ["ticket_product_id", "venue_row_id", "seat_number", "show_date"],
    unique: true,
  },
])
