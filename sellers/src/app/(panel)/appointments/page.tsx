import { Overview } from "@modules/appointments/components/overview"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Booking Overview" }

export default function AppointmentsIndexPage() {
  return (
    <div className="p-6">
      <Overview />
    </div>
  )
}
