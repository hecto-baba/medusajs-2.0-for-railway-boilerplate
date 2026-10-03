import { model } from "@medusajs/framework/utils"
import { Appointment } from "./appointment"

export const AppointmentAttendee = model.define("appointment_attendee", {
  id: model.id().primaryKey(),
  appointment: model.belongsTo(() => Appointment, {
    mappedBy: "attendees",
  }),
  // Null for guest buyers. Registered customers are also identified by it, so
  // a customer cannot hold the same slot twice (partial unique index created
  // in the migration - it ignores cancelled rows so a cancelled customer can
  // rebook).
  customer_id: model.text().nullable(),
  buyer_name: model.text().nullable(),
  buyer_email: model.text().nullable(),
  buyer_phone: model.text().nullable(),
  notes: model.text().nullable(),
  order_id: model.text().nullable(),
  line_item_id: model.text().nullable(),
  // reserved = held while the buyer pays (expires_at set); confirmed = paid.
  status: model
    .enum(["reserved", "confirmed", "cancelled"])
    .default("reserved"),
  // Only meaningful while status = reserved.
  expires_at: model.dateTime().nullable(),
  // Set once the confirmation emails have gone out, so a redelivered event can
  // never email the same booking twice.
  confirmation_sent_at: model.dateTime().nullable(),
  cancelled_at: model.dateTime().nullable(),
  cancelled_by: model
    .enum(["buyer", "vendor", "admin", "system"])
    .nullable(),
  cancel_reason: model.text().nullable(),
})
.indexes([
  {
    on: ["appointment_id"],
  },
  {
    on: ["customer_id"],
  },
])
