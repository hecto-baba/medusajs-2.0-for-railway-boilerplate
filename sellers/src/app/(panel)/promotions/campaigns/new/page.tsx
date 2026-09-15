import { CampaignForm } from "@modules/campaigns"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Create Campaign | Seller Panel",
}

export default function NewCampaignPage() {
  return (
    <div className="p-6">
      <CampaignForm />
    </div>
  )
}
