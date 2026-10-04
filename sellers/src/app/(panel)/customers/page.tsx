import { CustomersTable } from "@modules/customers/components/customers-table"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Customers" }

export default function CustomersPage() {
  return (
    <div className="p-6">
      <CustomersTable />
    </div>
  )
}
