import { Bookings } from "@modules/appointments/components/bookings"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Bookings" }

export default function BookingsPage() {
  return (
    <div className="p-6">
      <Bookings />
    </div>
  )
}
