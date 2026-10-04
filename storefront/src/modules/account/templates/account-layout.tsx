import React from "react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"

import AccountNav from "../components/account-nav"
import { HttpTypes } from "@medusajs/types"

interface AccountLayoutProps {
  customer: HttpTypes.StoreCustomer | null
  children: React.ReactNode
}

const AccountLayout: React.FC<AccountLayoutProps> = ({
  customer,
  children,
}) => {
  return (
    <div className="flex-1 bg-canvas py-6 small:py-10" data-testid="account-page">
      <div className="content-container flex flex-col gap-6">
        {customer ? (
          <div className="grid grid-cols-1 items-start gap-6 small:grid-cols-[260px_minmax(0,1fr)]">
            <AccountNav customer={customer} />
            <div className="min-w-0 flex-1">{children}</div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-lg">{children}</div>
        )}
        <div className="flex flex-col items-start justify-between gap-4 rounded-large bg-card p-5 shadow-lift small:flex-row small:items-center">
          <div>
            <h3 className="font-display text-xl font-extrabold tracking-tight">
              Got questions?
            </h3>
            <p className="mt-1 text-sm text-muted">
              You can find frequently asked questions and answers on our
              customer service page.
            </p>
          </div>
          <LocalizedClientLink
            href="/customer-service"
            className="inline-flex items-center rounded-large border-[1.5px] border-brand bg-card px-4 py-2.5 text-sm font-extrabold text-brand hover:bg-brand-soft"
          >
            Customer Service
          </LocalizedClientLink>
        </div>
      </div>
    </div>
  )
}

export default AccountLayout
