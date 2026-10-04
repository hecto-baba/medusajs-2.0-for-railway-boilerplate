import { redirect } from "next/navigation"

// The single "My Schedule" page was replaced by Appointments > Resources, where
// a business manages every bookable resource and its own calendar. Old
// bookmarks land there.
export default function MySchedulePage() {
  redirect("/appointments/resources")
}
