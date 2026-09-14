import { CollectionsTable } from "@modules/collections"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Collections | Seller Dashboard",
  description: "Manage your product collections",
}

export default function CollectionsPage() {
  return <CollectionsTable />
}
