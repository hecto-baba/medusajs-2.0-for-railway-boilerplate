import { ProductOptionsTable } from "@modules/product-options"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Product Options | Seller Dashboard",
  description: "Manage product options and variant configurations",
}

export default function ProductOptionsPage() {
  return <ProductOptionsTable />
}
