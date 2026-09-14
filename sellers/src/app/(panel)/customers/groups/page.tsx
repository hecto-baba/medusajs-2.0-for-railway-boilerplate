import { CustomerGroupsTable } from "@modules/customers"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Customer Groups" }

export default function CustomerGroupsPage() {
  return (
    <div className="p-6">
      <div className="bg-ui-bg-base shadow-elevation-card-rest overflow-hidden rounded-lg p-6">
        <CustomerGroupsTable />
      </div>
    </div>
  )
}
