import { PromotionForm } from "@modules/promotions/components/promotion-form"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Create promotion" }

export default function NewPromotionPage() {
  return (
    <div className="p-6">
      <PromotionForm />
    </div>
  )
}
