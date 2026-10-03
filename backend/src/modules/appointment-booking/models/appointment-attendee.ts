import { model } from "@medusajs/framework/utils"
import { Appointment } from "./appointment"

export const AppointmentAttendee = model.define("appointment_attendee", {
  id: model.id().primaryKey(),
  appointment: model.belongsTo(() => Appointment, {
    mappedBy: "attendees",
  }),
  customer_id: model.text(),
  order_id: model.text().nullable(),
  line_item_id: model.text().nullable(),
  status: model
    .enum(["reserved", "confirmed", "cancelled"])
    .default("reserved"),
})
.indexes([
  {
    on: ["appointment_id"],
  },
  // One customer can't double-book the same slot.
  {
    on: ["appointment_id", "customer_id"],
    unique: true,
  },
])
