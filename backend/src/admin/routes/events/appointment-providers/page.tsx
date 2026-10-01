import { defineRouteConfig } from "@medusajs/admin-sdk"
import AppointmentProvidersPage from "../../appointment-providers/page"

export const config = defineRouteConfig({
  label: "Appointment Providers",
  rank: 3,
})

export default AppointmentProvidersPage
