import { model } from "@medusajs/framework/utils"

/**
 * One row per file a seller uploaded through /vendors/uploads.
 *
 * Medusa's file module has no notion of an owner, so a stored file belongs to
 * nobody. This row is what makes an upload attributable to the seller who made
 * it: it can be listed back to them, counted against a quota, audited, and
 * cleaned up when the seller goes. The file itself is still served from its public
 * URL (product images are public by design).
 */
export const VendorUpload = model.define("vendor_upload", {
  id: model.id().primaryKey(),
  vendor_id: model.text().index(),
  // The id the file module returned, and the URL it is served from.
  file_id: model.text().unique(),
  url: model.text(),
  filename: model.text().nullable(),
  mime_type: model.text().nullable(),
  size: model.number().nullable(),
})
