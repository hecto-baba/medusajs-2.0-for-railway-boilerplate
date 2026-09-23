import { Metadata } from "next"
import { getCustomerCompany, getCompanyApprovals } from "@lib/data/company"
import { getCustomer } from "@lib/data/customer"
import { notFound } from "next/navigation"
import { ApprovalsList } from "@modules/account/components/approvals-list"

export const metadata: Metadata = {
  title: "Approvals",
  description: "Review and approve company team purchase requests.",
}

export default async function ApprovalsPage() {
  const customer = await getCustomer()
  if (!customer) {
    notFound()
  }

  const { is_manager } = await getCustomerCompany()
  const approvals = await getCompanyApprovals()

  return (
    <div className="w-full">
      <div className="mb-8 flex flex-col gap-y-4">
        <h1 className="text-2xl-semi">Team Approvals</h1>
        <p className="text-base-regular text-ui-fg-subtle">
          Review purchase requests submitted by employees exceeding spending limits.
        </p>
      </div>

      {!is_manager ? (
        <div className="border border-dashed rounded-lg p-8 text-center bg-gray-50">
          <p className="text-base-semi mb-2">Manager Access Required</p>
          <p className="text-sm text-ui-fg-subtle max-w-md mx-auto">
            Only designated Company Managers can review and approve purchase requests. If you should be a manager, contact your administrator.
          </p>
        </div>
      ) : (
        <ApprovalsList initialApprovals={approvals} />
      )}
    </div>
  )
}
