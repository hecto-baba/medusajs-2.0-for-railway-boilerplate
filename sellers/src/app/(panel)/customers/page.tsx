import { CustomersTable } from "@modules/customers"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Customers" }

export default function CustomersPage() {
  return (
    <div className="p-6">
      <CustomersTable />
    </div>
  )
}
