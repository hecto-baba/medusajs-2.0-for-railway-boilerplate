import { CustomerGroupsTable } from "@modules/customers"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Customer Groups" }

export default function CustomerGroupsPage() {
  return (
    <div className="p-6">
      <CustomerGroupsTable />
    </div>
  )
}
