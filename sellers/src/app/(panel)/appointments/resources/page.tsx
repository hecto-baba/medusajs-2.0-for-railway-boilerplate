import { ResourcesList } from "@modules/appointments/components/resources-list"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Resources" }

export default function ResourcesPage() {
  return (
    <div className="p-6">
      <ResourcesList />
    </div>
  )
}
