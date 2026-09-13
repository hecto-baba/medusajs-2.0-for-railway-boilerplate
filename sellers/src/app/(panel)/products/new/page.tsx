import { ProductForm } from "@modules/products"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Create product" }

export default function NewProductPage() {
  return (
    <div className="p-6">
      <ProductForm />
    </div>
  )
}
