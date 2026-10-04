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
  // How the rental reaches the renter: the renter chooses ("both"), or the
  // seller offers pickup only or delivery only. "pickup" needs no delivery
  // address at checkout.
  fulfilment_modes: model.enum(["both", "pickup", "delivery"]).default("both"),
  status: model.enum(["active", "inactive"]).default("active"),
  rentals: model.hasMany(() => Rental, {
    mappedBy: "rental_configuration",
  }),
})
