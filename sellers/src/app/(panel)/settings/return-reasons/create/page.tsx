import { RouteDrawer } from "@modules/common/components/route-drawer/route-drawer"
import { ReturnReasonForm } from "@modules/settings/components/return-reason-form"
import { ReturnReasonsTable } from "@modules/settings/components/return-reasons-table"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Create return reason" }

export default function CreateReturnReasonPage() {
  return (
    <div className="flex flex-col gap-y-3 p-6">
      <ReturnReasonsTable />
      <RouteDrawer returnTo="/settings/return-reasons">
        <ReturnReasonForm />
      </RouteDrawer>
    </div>
  )
}
