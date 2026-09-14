import { ReturnReasonsTable } from "@modules/settings"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Return Reasons" }

export default function ReturnReasonsPage() {
  return (
    <div className="flex flex-col gap-y-3 p-6">
      <ReturnReasonsTable />
    </div>
  )
}
