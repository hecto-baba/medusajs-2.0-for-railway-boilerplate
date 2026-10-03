import { OrderDetail } from "@modules/orders/components/detail/order-detail"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Order Details | Seller Dashboard",
  description: "View order details and manage rentals booked on your products",
}

type Props = {
  params: Promise<{ id: string }>
}

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params
  return <OrderDetail id={id} />
}
