import { InventoryDetail } from "@modules/inventory"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Inventory Item" }

export default async function InventoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="p-6">
      <InventoryDetail id={id} />
    </div>
  )
}
