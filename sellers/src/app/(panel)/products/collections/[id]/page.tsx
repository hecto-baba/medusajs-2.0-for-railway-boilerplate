import { CollectionDetail } from "@modules/collections"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Collection Details | Seller Dashboard",
  description: "View and manage collection details",
}

type Props = {
  params: Promise<{ id: string }>
}

export default async function CollectionDetailPage({ params }: Props) {
  const { id } = await params
  return <CollectionDetail id={id} />
}
