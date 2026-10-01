import { Metadata } from "next"
import { getCustomerCompany } from "@lib/data/company"
import { getCustomer } from "@lib/data/customer"
import { notFound } from "next/navigation"
import { CompanyTeam } from "@modules/account/components/company-team"

export const metadata: Metadata = {
  title: "Company",
  description: "View your business account and company details.",
}

export default async function CompanyPage() {
  const customer = await getCustomer()
  if (!customer) {
    notFound()
  }

  const { company, employee, employees, is_manager, spending_limit } =
    await getCustomerCompany()

  return (
    <div className="w-full">
      <div className="mb-8 flex flex-col gap-y-4">
        <h1 className="text-2xl-semi">Company Overview</h1>
        <p className="text-base-regular text-ui-fg-subtle">
          View your corporate account profile, membership status, and spending privileges.
        </p>
      </div>

      {!company ? (
        <div className="border border-dashed rounded-lg p-8 text-center bg-gray-50">
          <p className="text-base-semi mb-2">Individual Customer Account</p>
          <p className="text-sm text-ui-fg-subtle max-w-md mx-auto">
            You are currently shopping as an individual customer. If your organization has a corporate wholesale account, contact your company manager to invite this email.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-y-6 w-full">
          {/* Company Card */}
          <div className="border rounded-lg p-6 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <div>
                <h2 className="text-xl-semi">{company.name}</h2>
                <p className="text-sm text-ui-fg-subtle">{company.email}</p>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Corporate Account
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-ui-fg-subtle block">Phone</span>
                <span className="font-medium">{company.phone || "—"}</span>
              </div>
              <div>
                <span className="text-ui-fg-subtle block">Address</span>
                <span className="font-medium">
                  {[company.address, company.city, company.state]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </span>
              </div>
              <div>
                <span className="text-ui-fg-subtle block">Operating Currency</span>
                <span className="font-medium">
                  {(company.currency_code || "EUR").toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Membership & Privileges Card */}
          <div className="border rounded-lg p-6 bg-white shadow-sm">
            <h3 className="text-lg-semi mb-4">Your Membership & Purchasing Role</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-md bg-gray-50 border">
                <span className="text-xs text-ui-fg-subtle uppercase block font-semibold mb-1">
                  Designated Role
                </span>
                <div className="flex items-center gap-x-2 my-1">
                  {is_manager ? (
                    <span className="inline-flex items-center gap-x-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                      🛡️ Company Manager
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-x-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                      👤 Company Employee (Buyer)
                    </span>
                  )}
                </div>
                <p className="text-xs text-ui-fg-subtle mt-1">
                  {is_manager
                    ? "You have administrative privileges to manage spending rules and approve team orders."
                    : "You can place orders on behalf of the company within your designated budget."}
                </p>
              </div>

              <div className="p-4 rounded-md bg-gray-50 border">
                <span className="text-xs text-ui-fg-subtle uppercase block font-semibold mb-1">
                  Per-Order Spending Limit
                </span>
                <div className="text-lg font-semibold">
                  {is_manager
                    ? "Unlimited"
                    : spending_limit
                    ? `${spending_limit.toLocaleString()} ${(company.currency_code || "EUR").toUpperCase()}`
                    : "No Limit Set"}
                </div>
                <p className="text-xs text-ui-fg-subtle mt-1">
                  {is_manager
                    ? "Managers do not require purchase authorization."
                    : "Orders exceeding this amount must be submitted to your manager for approval."}
                </p>
              </div>
            </div>
          </div>

          {/* Team Members & Colleague Management */}
          <CompanyTeam
            initialEmployees={employees}
            isManager={is_manager}
            currencyCode={company.currency_code || "EUR"}
          />
        </div>
      )}
    </div>
  )
}
