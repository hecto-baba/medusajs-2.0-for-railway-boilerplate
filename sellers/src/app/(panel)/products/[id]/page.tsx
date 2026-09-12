import { ProductEditor } from "@modules/components/product-editor"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Edit product" }

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="p-6">
      <ProductEditor id={id} />
    </div>
  )
}
