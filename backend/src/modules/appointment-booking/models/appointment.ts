import { model } from "@medusajs/framework/utils"
import { Provider } from "./provider"
import { AppointmentAttendee } from "./appointment-attendee"

export const Appointment = model.define("appointment", {
  id: model.id().primaryKey(),
  provider: model.belongsTo(() => Provider, {
    mappedBy: "appointments",
  }),
  service_product_id: model.text(),
  service_variant_id: model.text().nullable(),
  start_time: model.dateTime(),
  end_time: model.dateTime(),
  max_capacity: model.number().default(1),
  status: model
    .enum(["available", "booked", "cancelled", "completed"])
    .default("available"),
  // Convenience for the common max_capacity = 1 case; the source of truth
  // for who's booked in is always appointment_attendee.
  order_id: model.text().nullable(),
  attendees: model.hasMany(() => AppointmentAttendee, {
    mappedBy: "appointment",
  }),
})
.indexes([
  {
    on: ["provider_id", "start_time", "end_time"],
  },
  {
    on: ["order_id"],
  },
])
