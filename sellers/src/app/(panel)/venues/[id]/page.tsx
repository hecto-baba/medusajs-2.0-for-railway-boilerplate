import { VenueDetail } from "@modules/venues"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Venue Details" }

export default async function VenueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="p-6">
      <VenueDetail id={id} />
    </div>
  )
}
