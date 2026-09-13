import { RouteDrawer } from "@modules/common"
import { RefundReasonForm, RefundReasonsTable } from "@modules/settings"
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
