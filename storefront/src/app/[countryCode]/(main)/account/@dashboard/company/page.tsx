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
      <div className="mb-4 flex flex-col gap-y-2 rounded-large bg-card p-5 shadow-lift">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Company Overview</h1>
        <p className="text-muted">
          View your corporate account profile, membership status, and spending privileges.
        </p>
      </div>

      {!company ? (
        <div className="rounded-large bg-card p-8 text-center shadow-lift">
          <p className="font-display text-lg font-extrabold tracking-tight mb-2">Individual Customer Account</p>
          <p className="text-sm text-muted max-w-md mx-auto">
            You are currently shopping as an individual customer. If your organization has a corporate wholesale account, contact your company manager to invite this email.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-y-6 w-full">
          {/* Company Card */}
          <div className="rounded-large p-5 bg-card shadow-lift">
            <div className="flex items-center justify-between border-b border-line pb-4 mb-4">
              <div>
                <h2 className="font-display text-xl font-extrabold tracking-tight">{company.name}</h2>
                <p className="text-sm text-muted">{company.email}</p>
              </div>
              <span className="inline-flex items-center rounded-circle bg-brand-soft px-2.5 py-1 text-xs font-bold leading-none text-brand">
                Corporate Account
              </span>
            </div>

            <div className="grid grid-cols-1 small:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted block">Phone</span>
                <span className="font-bold">{company.phone || "—"}</span>
              </div>
              <div>
                <span className="text-muted block">Address</span>
                <span className="font-bold">
                  {[company.address, company.city, company.state]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </span>
              </div>
              <div>
                <span className="text-muted block">Operating Currency</span>
                <span className="font-bold">
                  {(company.currency_code || "EUR").toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Membership & Privileges Card */}
          <div className="rounded-large p-5 bg-card shadow-lift">
            <h3 className="font-display text-lg font-extrabold tracking-tight mb-4">Your Membership & Purchasing Role</h3>
            <div className="grid grid-cols-1 small:grid-cols-2 gap-4">
              <div className="p-4 rounded-[12px] bg-canvas border border-line">
                <span className="text-xs text-muted uppercase block font-bold mb-1">
                  Designated Role
                </span>
                <div className="flex items-center gap-x-2 my-1">
                  {is_manager ? (
                    <span className="inline-flex items-center gap-x-1.5 rounded-circle bg-brand-soft px-3 py-1 text-sm font-bold text-brand">
                      Company Manager
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-x-1.5 rounded-circle bg-success-soft px-3 py-1 text-sm font-bold text-success">
                      Company Employee (Buyer)
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted mt-1">
                  {is_manager
                    ? "You have administrative privileges to manage spending rules and approve team orders."
                    : "You can place orders on behalf of the company within your designated budget."}
                </p>
              </div>

              <div className="p-4 rounded-[12px] bg-canvas border border-line">
                <span className="text-xs text-muted uppercase block font-bold mb-1">
                  Per-Order Spending Limit
                </span>
                <div className="text-lg font-extrabold">
                  {is_manager
                    ? "Unlimited"
                    : spending_limit
                    ? `${spending_limit.toLocaleString()} ${(company.currency_code || "EUR").toUpperCase()}`
                    : "No Limit Set"}
                </div>
                <p className="text-xs text-muted mt-1">
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
