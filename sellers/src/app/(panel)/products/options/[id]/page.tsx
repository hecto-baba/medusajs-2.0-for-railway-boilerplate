import { ProductOptionDetail } from "@modules/product-options"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Product Option Details | Seller Dashboard",
  description: "View and manage product option details",
}

type Props = {
  params: Promise<{ id: string }>
}

export default async function ProductOptionDetailPage({ params }: Props) {
  const { id } = await params
  return <ProductOptionDetail id={id} />
}
