import { PromotionEditor } from "@modules/promotions"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Edit promotion" }

export default async function EditPromotionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="p-6">
      <PromotionEditor id={id} />
    </div>
  )
}
