import { ProductForm } from "@modules/components/product-form"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Create product" }

export default function NewProductPage() {
  return (
    <div className="p-6">
      <ProductForm />
    </div>
  )
}
