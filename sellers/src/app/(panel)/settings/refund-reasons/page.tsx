import { RefundReasonsTable } from "@modules/settings"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Refund Reasons" }

export default function RefundReasonsPage() {
  return (
    <div className="flex flex-col gap-y-3 p-6">
      <RefundReasonsTable />
    </div>
  )
}
