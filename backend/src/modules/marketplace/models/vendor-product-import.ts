import { model } from "@medusajs/framework/utils"

/**
 * One row per CSV product import a seller has started.
 *
 * Medusa's import pipeline knows nothing about sellers: it runs in a background
 * step with no request, and the products it creates are not linked to anyone.
 * This row is what lets us (a) refuse another seller's attempt to confirm an
 * import, and (b) link the products an import creates back to the seller who
 * started it, using the product handles listed here.
 */
export const VendorProductImport = model.define("vendor_product_import", {
  id: model.id().primaryKey(),
  vendor_id: model.text().index(),
  // The workflow transaction id Medusa returns when the import starts.
  transaction_id: model.text().unique(),
  // The uploaded CSV, so the same file cannot be imported by another seller.
  file_key: model.text(),
  // Handles of the products this import will create (unique across products).
  handles: model.json(),
  // pending -> confirmed
  status: model.text().default("pending"),
})
