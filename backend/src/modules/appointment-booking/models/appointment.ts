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
  // Buffers snapshot the resource's settings at the time the slot was first
  // reserved, so later edits to the resource never move an existing booking.
  buffer_before_minutes: model.number().default(0),
  buffer_after_minutes: model.number().default(0),
  // start_time/end_time widened by the buffers. Maintained by a database
  // trigger (see the 2026-10 migration), NOT by application code, so it can
  // never drift from start/end/buffers. The overlap exclusion constraint is
  // built on these, which is what makes buffers impossible to violate.
  block_start: model.dateTime().nullable(),
  block_end: model.dateTime().nullable(),
  // IANA zone of the resource when the slot was reserved - for display/audit.
  resource_timezone: model.text().nullable(),
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
