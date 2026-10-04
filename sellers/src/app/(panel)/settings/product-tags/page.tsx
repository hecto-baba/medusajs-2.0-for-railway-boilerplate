import { ProductTagsTable } from "@modules/settings/components/product-tags/product-tags-table"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Product Tags" }

export default function ProductTagsPage() {
  return (
    <div className="flex flex-col gap-y-3 p-6">
      <ProductTagsTable />
    </div>
  )
}
