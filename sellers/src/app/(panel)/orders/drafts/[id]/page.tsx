import { DraftOrderDetail } from "@modules/draft-orders"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Draft Order Details | Seller Dashboard",
  description: "View and manage draft order details",
}

type Props = {
  params: Promise<{ id: string }>
}

export default async function DraftOrderDetailPage({ params }: Props) {
  const { id } = await params
  return <DraftOrderDetail id={id} />
}
