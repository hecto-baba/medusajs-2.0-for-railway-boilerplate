import { RouteDrawer } from "@modules/common/components/route-drawer/route-drawer"
import { RefundReasonForm } from "@modules/settings/components/refund-reason-form"
import { RefundReasonsTable } from "@modules/settings/components/refund-reasons-table"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Create refund reason" }

export default function CreateRefundReasonPage() {
  return (
    <div className="flex flex-col gap-y-3 p-6">
      <RefundReasonsTable />
      <RouteDrawer returnTo="/settings/refund-reasons">
        <RefundReasonForm />
      </RouteDrawer>
    </div>
  )
}
