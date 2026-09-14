import { CategoriesTable } from "@modules/categories"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Categories | Seller Dashboard",
  description: "Manage product taxonomy and categories",
}

export default function CategoriesPage() {
  return <CategoriesTable />
}
