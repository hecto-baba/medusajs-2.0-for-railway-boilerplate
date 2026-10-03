import { MySchedule } from "@modules/appointments"
import { Metadata } from "next"

export const metadata: Metadata = { title: "My Schedule" }

export default function MySchedulePage() {
  return (
    <div className="p-6">
      <MySchedule />
    </div>
  )
}
