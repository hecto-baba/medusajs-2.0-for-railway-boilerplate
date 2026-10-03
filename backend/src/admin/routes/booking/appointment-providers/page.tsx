import { defineRouteConfig } from "@medusajs/admin-sdk"
import AppointmentProvidersPage from "../../appointment-providers/page"

// Nested under the "Booking" sidebar group (route prefix /booking).
export const config = defineRouteConfig({
  label: "Appointment Providers",
  rank: 10,
})

export default AppointmentProvidersPage
