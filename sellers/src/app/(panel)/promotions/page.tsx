import { PromotionsTable } from "@modules/promotions"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Promotions" }

export default function PromotionsPage() {
  return (
    <div className="p-6">
      <PromotionsTable />
    </div>
  )
}
