import { CategoriesTable } from "@modules/categories"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Categories | Seller Dashboard",
  description: "Organize products into categories",
}

export default function CategoriesPage() {
  return (
    <div className="p-6">
      <CategoriesTable />
    </div>
  )
}
