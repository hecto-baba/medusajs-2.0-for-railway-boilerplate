import { ReservationDetail } from "@modules/inventory"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Reservation Details",
  description: "View and manage reservation details.",
}

export default async function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <ReservationDetail id={id} />
}
