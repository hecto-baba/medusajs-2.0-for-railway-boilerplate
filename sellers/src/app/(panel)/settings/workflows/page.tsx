import { WorkflowsTable } from "@modules/settings"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Workflows" }

export default function WorkflowsPage() {
  return (
    <div className="flex flex-col gap-y-3 p-6">
      <WorkflowsTable />
    </div>
  )
}
