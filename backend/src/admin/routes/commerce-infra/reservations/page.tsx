import { defineRouteConfig } from "@medusajs/admin-sdk"
import { CoreRedirectPage } from "../../../lib/core-redirect"

const CommerceReservationsPage = () => (
  <CoreRedirectPage title="Reservations" to="/reservations" />
)

export const config = defineRouteConfig({
  label: "Reservations",
  rank: 7,
})

export default CommerceReservationsPage
