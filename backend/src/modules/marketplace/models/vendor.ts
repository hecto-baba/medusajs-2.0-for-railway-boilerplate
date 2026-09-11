import { model } from "@medusajs/framework/utils"
import { VendorAdmin } from "./vendor-admin"

export const Vendor = model.define("vendor", {
  id: model.id().primaryKey(),
  handle: model.text().unique(),
  name: model.text(),
  logo: model.text().nullable(),
  admins: model.hasMany(() => VendorAdmin, {
    mappedBy: "vendor",
  }),
})
.cascades({
  delete: ["admins"],
})
