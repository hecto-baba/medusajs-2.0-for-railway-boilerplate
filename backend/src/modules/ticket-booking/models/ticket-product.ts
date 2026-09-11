import { model } from "@medusajs/framework/utils"
import { Venue } from "./venue"
import { TicketProductVariant } from "./ticket-product-variant"
import { TicketPurchase } from "./ticket-purchase"

/**
 * A show: a Medusa Product sold as tickets at a venue on a set of dates.
 * The Product itself owns the title, media and pricing - this model only
 * adds what the Product Module has no concept of.
 */
export const TicketProduct = model.define("ticket_product", {
  id: model.id().primaryKey(),
  product_id: model.text().unique(),
  venue: model.belongsTo(() => Venue),
  dates: model.array(),
  variants: model.hasMany(() => TicketProductVariant, {
    mappedBy: "ticket_product",
  }),
  purchases: model.hasMany(() => TicketPurchase, {
    mappedBy: "ticket_product",
  }),
})
.indexes([
  // Venue availability is always checked as "this venue, on these dates", so
  // the index covers both columns rather than the venue alone.
  {
    on: ["venue_id", "dates"],
  },
])
