import { LocationDetail } from "@modules/settings"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Location Details" }

export default async function LocationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return <LocationDetail id={id} />
}
