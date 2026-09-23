import { CustomerGroupDetail } from "@modules/customers"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Customer Group Details" }

export default async function CustomerGroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="p-6">
      <CustomerGroupDetail id={id} />
    </div>
  )
}
