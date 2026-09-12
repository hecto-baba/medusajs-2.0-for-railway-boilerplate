import { ProductsTable } from "@modules/components/products-table"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Products" }

export default function ProductsPage() {
  return (
    <div className="p-6">
      <div className="bg-ui-bg-base shadow-elevation-card-rest rounded-lg overflow-hidden">
        <ProductsTable />
      </div>
    </div>
  )
}
