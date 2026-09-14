import { CustomersTable } from "@modules/customers"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Customers" }

export default function CustomersPage() {
  return (
    <div className="p-6">
      <div className="bg-ui-bg-base shadow-elevation-card-rest overflow-hidden rounded-lg p-6">
        <CustomersTable />
      </div>
    </div>
  )
}
