import { RouteDrawer } from "@modules/common"
import { ReturnReasonForm, ReturnReasonsTable } from "@modules/settings"
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
