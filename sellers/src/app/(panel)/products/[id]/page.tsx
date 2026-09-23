import { ProductDetail } from "@modules/products"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Product" }

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="p-6">
      <ProductDetail id={id} />
    </div>
  )
}
