import { model } from "@medusajs/framework/utils"
import { Rental } from "./rental"

export const RentalConfiguration = model.define("rental_configuration", {
  id: model.id().primaryKey(),
  product_id: model.text(),
  // Deprecated in favor of rental_unit + min/max_rental_units below.
  // Kept so existing rows and any un-migrated callers keep working; day-unit
  // configs mirror their values into both column pairs.
  min_rental_days: model.number().default(1),
  max_rental_days: model.number().nullable(),
  rental_unit: model
    .enum(["hour", "day", "week", "month", "custom"])
    .default("day"),
  min_rental_units: model.number().default(1),
  max_rental_units: model.number().nullable(),
  security_deposit_amount: model.bigNumber().default(0),
  security_deposit_type: model.enum(["fixed", "percentage"]).default("fixed"),
  requires_time_selection: model.boolean().default(false),
  status: model.enum(["active", "inactive"]).default("active"),
  rentals: model.hasMany(() => Rental, {
    mappedBy: "rental_configuration",
  }),
})
