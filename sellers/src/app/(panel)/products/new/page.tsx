import { NewProductView } from "@modules/products/components/new-product-view"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Create product" }

export default function NewProductPage() {
  return (
    <div className="p-6">
      <NewProductView />
    </div>
  )
}
