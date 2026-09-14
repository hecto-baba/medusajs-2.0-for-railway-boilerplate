import { RefundReasonEditDrawer, RefundReasonsTable } from "@modules/settings"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Edit refund reason" }

export default async function EditRefundReasonPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="flex flex-col gap-y-3 p-6">
      <RefundReasonsTable />
      <RefundReasonEditDrawer id={id} />
    </div>
  )
}
