import { PromotionDetail } from "@modules/promotions"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Promotion" }

export default async function PromotionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="p-6">
      <PromotionDetail id={id} />
    </div>
  )
}
