import { CampaignDetail } from "@modules/campaigns/components/campaign-detail"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Campaign Details | Seller Panel",
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="p-6">
      <CampaignDetail id={id} />
    </div>
  )
}
