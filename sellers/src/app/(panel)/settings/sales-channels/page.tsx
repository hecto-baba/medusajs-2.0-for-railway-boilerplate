import { SalesChannelsTable } from "@modules/settings"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Sales Channels" }

export default function SalesChannelsPage() {
  return (
    <div className="flex flex-col gap-y-3 p-6">
      <SalesChannelsTable />
    </div>
  )
}
