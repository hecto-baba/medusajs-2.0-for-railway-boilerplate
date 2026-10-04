import { Container } from "@medusajs/ui"

import ChevronDown from "@modules/common/icons/chevron-down"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"

type OverviewProps = {
  customer: HttpTypes.StoreCustomer | null
  orders: HttpTypes.StoreOrder[] | null
}

const Overview = ({ customer, orders }: OverviewProps) => {
  return (
    <div data-testid="overview-page-wrapper">
      <div className="hidden small:block">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-large bg-card p-5 shadow-lift">
            <h1 className="font-display text-2xl font-extrabold tracking-tight">
              <span
                data-testid="welcome-message"
                data-value={customer?.first_name}
              >
                Hello {customer?.first_name}
              </span>
            </h1>
            <span className="text-sm text-muted">
              Signed in as:{" "}
              <span
                className="font-bold text-ink"
                data-testid="customer-email"
                data-value={customer?.email}
              >
                {customer?.email}
              </span>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-y-2 rounded-large bg-card p-5 shadow-lift">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted">
                Profile
              </h3>
              <div className="flex items-end gap-x-2">
                <span
                  className="font-display text-4xl font-extrabold leading-none tracking-tight"
                  data-testid="customer-profile-completion"
                  data-value={getProfileCompletion(customer)}
                >
                  {getProfileCompletion(customer)}%
                </span>
                <span className="text-sm uppercase text-muted">Completed</span>
              </div>
            </div>

            <div className="flex flex-col gap-y-2 rounded-large bg-card p-5 shadow-lift">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted">
                Addresses
              </h3>
              <div className="flex items-end gap-x-2">
                <span
                  className="font-display text-4xl font-extrabold leading-none tracking-tight"
                  data-testid="addresses-count"
                  data-value={customer?.addresses?.length || 0}
                >
                  {customer?.addresses?.length || 0}
                </span>
                <span className="text-sm uppercase text-muted">Saved</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-y-4 rounded-large bg-card p-5 shadow-lift">
            <h3 className="font-display text-xl font-extrabold tracking-tight">
              Recent orders
            </h3>
            <ul className="flex flex-col gap-y-3" data-testid="orders-wrapper">
              {orders && orders.length > 0 ? (
                orders.slice(0, 5).map((order) => {
                  return (
                    <li
                      key={order.id}
                      data-testid="order-wrapper"
                      data-value={order.id}
                    >
                      <LocalizedClientLink
                        href={`/account/orders/details/${order.id}`}
                      >
                        <div className="flex items-center justify-between rounded-[12px] border border-line bg-canvas p-4 hover:border-brand">
                          <div className="grid flex-1 grid-cols-3 grid-rows-2 gap-x-4 gap-y-1 text-sm">
                            <span className="font-bold text-muted">
                              Date placed
                            </span>
                            <span className="font-bold text-muted">
                              Order number
                            </span>
                            <span className="font-bold text-muted">
                              Total amount
                            </span>
                            <span data-testid="order-created-date">
                              {new Date(order.created_at).toDateString()}
                            </span>
                            <span
                              data-testid="order-id"
                              data-value={order.display_id}
                            >
                              #{order.display_id}
                            </span>
                            <span
                              className="font-bold"
                              data-testid="order-amount"
                            >
                              {convertToLocale({
                                amount: order.total,
                                currency_code: order.currency_code,
                              })}
                            </span>
                          </div>
                          <button
                            className="flex items-center justify-between text-brand"
                            data-testid="open-order-button"
                          >
                            <span className="sr-only">
                              Go to order #{order.display_id}
                            </span>
                            <ChevronDown className="-rotate-90" />
                          </button>
                        </div>
                      </LocalizedClientLink>
                    </li>
                  )
                })
              ) : (
                <span className="text-muted" data-testid="no-orders-message">
                  No recent orders
                </span>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

const getProfileCompletion = (customer: HttpTypes.StoreCustomer | null) => {
  let count = 0

  if (!customer) {
    return 0
  }

  if (customer.email) {
    count++
  }

  if (customer.first_name && customer.last_name) {
    count++
  }

  if (customer.phone) {
    count++
  }

  const billingAddress = customer.addresses?.find(
    (addr) => addr.is_default_billing
  )

  if (billingAddress) {
    count++
  }

  return (count / 4) * 100
}

export default Overview
