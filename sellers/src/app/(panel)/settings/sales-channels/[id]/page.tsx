import { SalesChannelDetail } from "@modules/settings/components/sales-channels/sales-channel-detail"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Sales Channel Details" }

export default async function SalesChannelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return <SalesChannelDetail id={id} />
}
