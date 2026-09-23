import { TeamTable } from "@modules/settings"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Team" }

export default function TeamSettingsPage() {
  return (
    <div className="flex flex-col gap-y-3 p-6">
      <TeamTable />
    </div>
  )
}
