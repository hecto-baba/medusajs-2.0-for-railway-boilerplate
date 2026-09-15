import { CampaignsTable } from "@modules/campaigns"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Campaigns | Seller Panel",
  description: "Manage marketing campaigns and promotion budgets.",
}

export default function CampaignsPage() {
  return (
    <div className="p-6">
      <div className="bg-ui-bg-base shadow-elevation-card-rest rounded-lg overflow-hidden">
        <CampaignsTable />
      </div>
    </div>
  )
}
