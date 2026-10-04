"use client"

import { clx } from "@medusajs/ui"
import { ArrowRightOnRectangle, Photo, Buildings, CheckCircle, DocumentText } from "@medusajs/icons"
import { useParams, usePathname } from "next/navigation"

import ChevronDown from "@modules/common/icons/chevron-down"
import User from "@modules/common/icons/user"
import MapPin from "@modules/common/icons/map-pin"
import Package from "@modules/common/icons/package"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"
import { signout } from "@lib/data/customer"

const mobileRow =
  "flex w-full items-center justify-between rounded-rounded px-3 py-3.5 text-left hover:bg-brand-soft"

const AccountNav = ({
  customer,
}: {
  customer: HttpTypes.StoreCustomer | null
}) => {
  const route = usePathname()
  const { countryCode } = useParams() as { countryCode: string }

  const handleLogout = async () => {
    await signout(countryCode)
  }

  return (
    <div>
      <div className="small:hidden" data-testid="mobile-account-nav">
        {route !== `/${countryCode}/account` ? (
          <LocalizedClientLink
            href="/account"
            className="inline-flex items-center gap-x-2 rounded-circle border border-line bg-card px-4 py-2 text-sm font-bold"
            data-testid="account-main-link"
          >
            <>
              <ChevronDown className="transform rotate-90" />
              <span>Account</span>
            </>
          </LocalizedClientLink>
        ) : (
          <div className="rounded-large bg-card p-3 shadow-lift">
            <div className="mb-2 px-3 pt-2 font-display text-xl font-extrabold tracking-tight">
              Hello {customer?.first_name}
            </div>
            <ul className="text-base">
              <li>
                <LocalizedClientLink
                  href="/account/profile"
                  className={mobileRow}
                  data-testid="profile-link"
                >
                  <>
                    <div className="flex items-center gap-x-2">
                      <User size={20} />
                      <span>Profile</span>
                    </div>
                    <ChevronDown className="transform -rotate-90" />
                  </>
                </LocalizedClientLink>
              </li>
              <li>
                <LocalizedClientLink
                  href="/account/addresses"
                  className={mobileRow}
                  data-testid="addresses-link"
                >
                  <>
                    <div className="flex items-center gap-x-2">
                      <MapPin size={20} />
                      <span>Addresses</span>
                    </div>
                    <ChevronDown className="transform -rotate-90" />
                  </>
                </LocalizedClientLink>
              </li>
              <li>
                <LocalizedClientLink
                  href="/account/orders"
                  className={mobileRow}
                  data-testid="orders-link"
                >
                  <div className="flex items-center gap-x-2">
                    <Package size={20} />
                    <span>Orders</span>
                  </div>
                  <ChevronDown className="transform -rotate-90" />
                </LocalizedClientLink>
              </li>
              <li>
                <LocalizedClientLink
                  href="/account/digital-products"
                  className={mobileRow}
                  data-testid="digital-products-link"
                >
                  <div className="flex items-center gap-x-2">
                    <Photo />
                    <span>Digital Products</span>
                  </div>
                  <ChevronDown className="transform -rotate-90" />
                </LocalizedClientLink>
              </li>
              {/* Dedicated B2B Section */}
              <li className="mt-2 border-t border-line px-3 pb-1 pt-4">
                <div className="text-xs font-bold uppercase tracking-wider text-muted">
                  <span>B2B Organization</span>
                </div>
              </li>
              <li>
                <LocalizedClientLink
                  href="/account/company"
                  className={mobileRow}
                  data-testid="company-link"
                >
                  <div className="flex items-center gap-x-2">
                    <Buildings />
                    <span>Company</span>
                  </div>
                  <ChevronDown className="transform -rotate-90" />
                </LocalizedClientLink>
              </li>
              <li>
                <LocalizedClientLink
                  href="/account/quotes"
                  className={mobileRow}
                  data-testid="quotes-link"
                >
                  <div className="flex items-center gap-x-2">
                    <DocumentText />
                    <span>Quotes</span>
                  </div>
                  <ChevronDown className="transform -rotate-90" />
                </LocalizedClientLink>
              </li>
              <li>
                <LocalizedClientLink
                  href="/account/approvals"
                  className={mobileRow}
                  data-testid="approvals-link"
                >
                  <div className="flex items-center gap-x-2">
                    <CheckCircle />
                    <span>Approvals</span>
                  </div>
                  <ChevronDown className="transform -rotate-90" />
                </LocalizedClientLink>
              </li>
              <li className="mt-2 border-t border-line pt-2">
                <button
                  type="button"
                  className={mobileRow}
                  onClick={handleLogout}
                  data-testid="logout-button"
                >
                  <div className="flex items-center gap-x-2">
                    <ArrowRightOnRectangle />
                    <span>Log out</span>
                  </div>
                  <ChevronDown className="transform -rotate-90" />
                </button>
              </li>
            </ul>
          </div>
        )}
      </div>
      <div
        className="hidden rounded-large bg-card p-4 shadow-lift small:block"
        data-testid="account-nav"
      >
        <div>
          <div className="px-3 pb-3 pt-1">
            <h3 className="font-display text-lg font-extrabold tracking-tight">
              Account
            </h3>
          </div>
          <ul className="mb-0 flex flex-col gap-y-1 text-base">
            <li>
              <AccountNavLink
                href="/account"
                route={route!}
                data-testid="overview-link"
              >
                Overview
              </AccountNavLink>
            </li>
            <li>
              <AccountNavLink
                href="/account/profile"
                route={route!}
                data-testid="profile-link"
              >
                Profile
              </AccountNavLink>
            </li>
            <li>
              <AccountNavLink
                href="/account/addresses"
                route={route!}
                data-testid="addresses-link"
              >
                Addresses
              </AccountNavLink>
            </li>
            <li>
              <AccountNavLink
                href="/account/orders"
                route={route!}
                data-testid="orders-link"
              >
                Orders
              </AccountNavLink>
            </li>
            <li>
              <AccountNavLink
                href="/account/digital-products"
                route={route!}
                data-testid="digital-products-link"
              >
                Digital Products
              </AccountNavLink>
            </li>
          </ul>

          {/* Dedicated B2B Section */}
          <div className="mt-4 border-t border-line pt-4">
            <div className="flex items-center gap-x-2 px-3 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                B2B Organization
              </h3>
            </div>
            <ul className="mb-0 flex flex-col gap-y-1 text-base">
              <li>
                <AccountNavLink
                  href="/account/company"
                  route={route!}
                  data-testid="company-link"
                >
                  <span className="flex items-center gap-x-2">
                    <Buildings className="w-4 h-4" />
                    <span>Company</span>
                  </span>
                </AccountNavLink>
              </li>
              <li>
                <AccountNavLink
                  href="/account/quotes"
                  route={route!}
                  data-testid="quotes-link"
                >
                  <span className="flex items-center gap-x-2">
                    <DocumentText className="w-4 h-4" />
                    <span>Quotes</span>
                  </span>
                </AccountNavLink>
              </li>
              <li>
                <AccountNavLink
                  href="/account/approvals"
                  route={route!}
                  data-testid="approvals-link"
                >
                  <span className="flex items-center gap-x-2">
                    <CheckCircle className="w-4 h-4" />
                    <span>Approvals</span>
                  </span>
                </AccountNavLink>
              </li>
              <li className="mt-2 w-full border-t border-line pt-2">
                <button
                  type="button"
                  onClick={handleLogout}
                  data-testid="logout-button"
                  className="w-full rounded-rounded px-3 py-2 text-left text-muted hover:bg-brand-soft hover:text-brand"
                >
                  Log out
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

type AccountNavLinkProps = {
  href: string
  route: string
  children: React.ReactNode
  "data-testid"?: string
}

const AccountNavLink = ({
  href,
  route,
  children,
  "data-testid": dataTestId,
}: AccountNavLinkProps) => {
  const { countryCode }: { countryCode: string } = useParams()

  const active = route.split(countryCode)[1] === href
  return (
    <LocalizedClientLink
      href={href}
      className={clx(
        "block rounded-rounded px-3 py-2 text-muted hover:bg-brand-soft hover:text-brand",
        {
          "bg-brand-soft font-bold text-brand": active,
        }
      )}
      data-testid={dataTestId}
    >
      {children}
    </LocalizedClientLink>
  )
}

export default AccountNav
