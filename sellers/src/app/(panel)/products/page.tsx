import { ProductsTable } from "@modules/products"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Products" }

export default function ProductsPage() {
  return (
    <div className="p-6">
      <ProductsTable />
    </div>
  )
}
