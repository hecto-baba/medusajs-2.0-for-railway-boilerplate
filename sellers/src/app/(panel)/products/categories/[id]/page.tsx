import { CategoryDetail } from "@modules/categories"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Category Details | Seller Dashboard",
  description: "View and manage product category details",
}

type Props = {
  params: Promise<{ id: string }>
}

export default async function CategoryDetailPage({ params }: Props) {
  const { id } = await params
  return <CategoryDetail id={id} />
}
