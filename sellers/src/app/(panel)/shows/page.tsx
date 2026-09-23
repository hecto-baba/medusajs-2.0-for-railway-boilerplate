import { ShowsTable } from "@modules/shows"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Shows" }

export default function ShowsPage() {
  return (
    <div className="p-6">
      <div className="bg-ui-bg-base shadow-elevation-card-rest overflow-hidden rounded-lg p-6">
        <ShowsTable />
      </div>
    </div>
  )
}
