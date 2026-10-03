import { model } from "@medusajs/framework/utils"

/**
 * One row per seller order carved out of a multi-seller order, and the seller's
 * payout ledger entry for it (decision D2: platform-held ledger).
 *
 * The buyer pays once, on the PARENT order (the order the cart completed into).
 * For each seller in it a CHILD order holds only that seller's items and
 * shipping, and this row records what the platform owes that seller for it.
 * The platform pays sellers out itself and marks the row paid.
 *
 * Amounts are exact decimals (Medusa BigNumber: a numeric column plus a raw
 * value), in the order's currency, rounded to the currency's precision when
 * written. They were first floats, which lose cents on large amounts.
 */
export const VendorOrderSplit = model
  .define("vendor_order_split", {
    id: model.id().primaryKey(),
    parent_order_id: model.text().index(),
    child_order_id: model.text().unique(),
    vendor_id: model.text().index(),
    currency_code: model.text(),
    items_total: model.bigNumber(),
    shipping_total: model.bigNumber(),
    tax_total: model.bigNumber(),
    total: model.bigNumber(),
    // Money returned to the buyer for this seller's order (refunds). The seller is
    // owed total minus this; it can exceed what is still owed once paid out, which
    // the platform then recovers.
    refunded_total: model.bigNumber().default(0),
    // owed -> paid, or void (e.g. the order was cancelled or refunded)
    payout_status: model.text().default("owed"),
    paid_at: model.dateTime().nullable(),
    payout_reference: model.text().nullable(),
  })
  .indexes([
    // A seller appears once per parent order, so a re-run never creates a second child.
    { on: ["parent_order_id", "vendor_id"], unique: true },
  ])
