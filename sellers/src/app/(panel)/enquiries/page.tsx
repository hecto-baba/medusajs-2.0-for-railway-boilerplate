import { EnquiriesTable } from "@modules/enquiries/components/enquiries-table"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Enquiries" }

export default function EnquiriesPage() {
  return (
    <div className="p-6">
      <EnquiriesTable />
    </div>
  )
}
