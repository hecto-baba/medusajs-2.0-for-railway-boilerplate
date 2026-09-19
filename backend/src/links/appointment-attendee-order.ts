import { defineLink } from "@medusajs/framework/utils"
import AppointmentBookingModule from "../modules/appointment-booking"
import OrderModule from "@medusajs/medusa/order"

// Not field-based like appointment-order.ts: written explicitly via
// createRemoteLinkStep once payment completes, since an attendee's order_id
// isn't known until checkout finishes (needed for the capacity > 1 case,
// where each attendee may be tied to their own order).
export default defineLink(
  {
    linkable: AppointmentBookingModule.linkable.appointmentAttendee,
    alias: "attendee_order",
    deleteCascade: true,
  },
  OrderModule.linkable.order
)
