import { InventoryTable } from "@modules/inventory"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Inventory" }

export default function InventoryPage() {
  return (
    <div className="p-6">
      <InventoryTable />
    </div>
  )
}
