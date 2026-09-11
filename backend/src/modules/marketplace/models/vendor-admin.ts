import { model } from "@medusajs/framework/utils"
import { Vendor } from "./vendor"

export const VendorAdmin = model.define("vendor_admin", {
  id: model.id().primaryKey(),
  first_name: model.text().nullable(),
  last_name: model.text().nullable(),
  // Globally unique: the auth identity for an admin maps to exactly one
  // vendor admin via app_metadata.vendor_id, so one email cannot administer
  // two vendors. Scoping this per vendor would need that mapping reworked.
  email: model.text().unique(),
  vendor: model.belongsTo(() => Vendor, {
    mappedBy: "admins",
  }),
})
