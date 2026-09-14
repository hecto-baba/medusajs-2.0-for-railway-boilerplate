import { ProductTypesTable } from "@modules/settings"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Product Types" }

export default function ProductTypesPage() {
  return (
    <div className="flex flex-col gap-y-3 p-6">
      <ProductTypesTable />
    </div>
  )
}
