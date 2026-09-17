import { model } from "@medusajs/framework/utils"
import { RentalConfiguration } from "./rental-configuration"

export const Rental = model.define("rental", {
  id: model.id().primaryKey(),
  variant_id: model.text(),
  customer_id: model.text(),
  order_id: model.text().nullable(),
  line_item_id: model.text().nullable(),
  rental_start_date: model.dateTime(),
  rental_end_date: model.dateTime(),
  actual_return_date: model.dateTime().nullable(),
  // Day-equivalent count, kept as the source of truth for existing
  // day-granularity overlap logic regardless of rental_unit.
  rental_days: model.number(),
  // Snapshot of the configuration's unit/quantity at booking time, since the
  // product's rental_configuration can change after the booking is made.
  rental_unit: model
    .enum(["hour", "day", "week", "month", "custom"])
    .default("day"),
  rental_units_count: model.number().nullable(),
  pickup_time: model.text().nullable(),
  return_time: model.text().nullable(),
  security_deposit_amount: model.bigNumber().default(0),
  security_deposit_status: model
    .enum(["held", "refunded", "partially_refunded", "forfeited"])
    .nullable(),
  status: model
    .enum(["pending", "active", "returned", "cancelled"])
    .default("pending"),
  rental_configuration: model.belongsTo(() => RentalConfiguration, {
    mappedBy: "rentals",
  }),
})
