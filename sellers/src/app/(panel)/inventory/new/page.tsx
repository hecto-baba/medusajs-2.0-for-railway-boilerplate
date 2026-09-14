import { InventoryCreateForm } from "@modules/inventory"
import { Metadata } from "next"

export const metadata: Metadata = { title: "New Inventory Item" }

export default function NewInventoryItemPage() {
  return (
    <div className="p-6">
      <InventoryCreateForm />
    </div>
  )
}
