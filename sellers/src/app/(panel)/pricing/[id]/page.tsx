import { PriceListDetail } from "@modules/pricing"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Price List Details" }

export default async function PriceListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="p-6">
      <PriceListDetail id={id} />
    </div>
  )
}
