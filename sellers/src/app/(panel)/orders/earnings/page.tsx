import { EarningsTable } from "@modules/orders/components/earnings-table"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Earnings | Seller Dashboard",
  description: "What you are owed for your orders",
}

export default function EarningsPage() {
  return <EarningsTable />
}
