import { model } from "@medusajs/framework/utils"
import { RowType } from "./venue-row"
import { TicketProduct } from "./ticket-product"
import { TicketPurchase } from "./ticket-purchase"

/**
 * One Product Variant of a show, identified by a date and a row type.
 * A show with 3 dates and 4 row types therefore has 12 variants, each
 * carrying its own inventory item and price.
 */
export const TicketProductVariant = model.define("ticket_product_variant", {
  id: model.id().primaryKey(),
  product_variant_id: model.text().unique(),
  ticket_product: model.belongsTo(() => TicketProduct, {
    mappedBy: "variants",
  }),
  row_type: model.enum(RowType),
  purchases: model.hasMany(() => TicketPurchase, {
    mappedBy: "ticket_variant",
  }),
})
.indexes([
  {
    on: ["ticket_product_id", "row_type"],
  },
])
