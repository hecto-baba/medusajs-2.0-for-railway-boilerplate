import { model } from "@medusajs/framework/utils"

/**
 * A single Expression of Interest transaction: a customer reserving a product
 * for a fraction of its price. product_id/variant_id/customer_id/order_id/
 * line_item_id are plain text columns, not FK relations — cross-module
 * references are expressed via module links (src/links/eoi-*.ts), keeping this
 * module isolated from Product/Customer/Order, same convention as
 * product-enquiry and rental. See docs/plan/EXPRESSION_OF_INTEREST_MODULE_PLAN.md
 * Phase 1.1.
 */
export const Eoi = model.define("eoi", {
  id: model.id().primaryKey(),
  product_id: model.text(),
  variant_id: model.text(),
  customer_id: model.text().nullable(),
  customer_email: model.text(),
  cart_id: model.text().nullable(), // populated at add-to-cart time
  order_id: model.text().nullable(), // populated once the cart completes
  line_item_id: model.text().nullable(), // populated once the cart completes
  value_type: model.enum(["fixed", "percentage"]),
  // Resolved amount actually quoted, snapshotted from EoiConfiguration at the
  // moment of quoting — never re-derived from current config later.
  value_amount: model.bigNumber(),
  quoted_unit_price: model.bigNumber(), // the product's price at the moment of quoting
  eoi_charged_amount: model.bigNumber(), // what was actually charged as the cart line's unit_price
  remaining_amount: model.bigNumber(), // quoted_unit_price - eoi_charged_amount
  status: model.enum(["pending", "converted", "cancelled"]).default("pending"),
})
