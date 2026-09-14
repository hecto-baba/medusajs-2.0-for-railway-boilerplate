import { CustomerDetail } from "@modules/customers"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Customer Details" }

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="p-6">
      <CustomerDetail id={id} />
    </div>
  )
}
