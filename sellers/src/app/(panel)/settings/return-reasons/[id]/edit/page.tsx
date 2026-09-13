import { ReturnReasonEditDrawer, ReturnReasonsTable } from "@modules/settings"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Edit return reason" }

export default async function EditReturnReasonPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="flex flex-col gap-y-3 p-6">
      <ReturnReasonsTable />
      <ReturnReasonEditDrawer id={id} />
    </div>
  )
}
