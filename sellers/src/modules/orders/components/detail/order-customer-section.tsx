"use client"

import type { VendorOrderDetail } from "@lib/data/vendor-client"
import { ArrowPath, CurrencyDollar, Envelope, FlyingBox } from "@medusajs/icons"
import { Avatar, Container, Copy, Heading, Text } from "@medusajs/ui"
import { ActionMenu } from "@modules/common"
import { formatAddress, isSameAddress } from "./order-format"

/**
 * The Customer card - ported from the admin's OrderCustomerSection and its
 * CustomerInfo parts: ID, Contact, Company, Shipping and Billing address.
 */

const Line = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="text-ui-fg-subtle grid grid-cols-2 items-start px-6 py-4">
    <Text size="small" leading="compact" weight="plus">
      {label}
    </Text>
    {children}
  </div>
)

const AddressPrint = ({
  label,
  address,
}: {
  label: string
  address?: Record<string, any> | null
}) => {
  const lines = formatAddress(address)

  return (
    <Line label={label}>
      {lines.length ? (
        <div className="grid grid-cols-[1fr_20px] items-start gap-x-2">
          <Text size="small" leading="compact">
            {lines.map((line, i) => (
              <span key={i} className="break-words">
                {line}
                <br />
              </span>
            ))}
          </Text>
          <div className="flex justify-end">
            <Copy content={lines.join("\n")} className="text-ui-fg-muted" />
          </div>
        </div>
      ) : (
        <Text size="small" leading="compact">
          -
        </Text>
      )}
    </Line>
  )
}

// The admin's edit menu. Sellers have no route to change these on an order yet,
// so the entries are shown, as in the admin, but disabled.
const noop = () => {}
const menuGroups = [
  { actions: [{ label: "Transfer ownership", icon: <ArrowPath />, onClick: noop, disabled: true }] },
  {
    actions: [
      { label: "Edit shipping address", icon: <FlyingBox />, onClick: noop, disabled: true },
      { label: "Edit billing address", icon: <CurrencyDollar />, onClick: noop, disabled: true },
    ],
  },
  { actions: [{ label: "Edit email", icon: <Envelope />, onClick: noop, disabled: true }] },
]

export const OrderCustomerSection = ({ order }: { order: VendorOrderDetail }) => {
  const shipping = order.shipping_address as Record<string, any> | null | undefined
  const billing = order.billing_address as Record<string, any> | null | undefined

  const fullName = (o?: Record<string, any> | null) =>
    [o?.first_name, o?.last_name].filter(Boolean).join(" ")
  const email = order.email ?? order.customer?.email ?? ""
  const name = fullName(order.customer) || fullName(shipping) || fullName(billing)
  const phone = (shipping?.phone || billing?.phone) as string | undefined
  const company = (shipping?.company || billing?.company) as string | undefined
  const fallback = (name || email).charAt(0).toUpperCase()

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Customer</Heading>
        <ActionMenu groups={menuGroups} />
      </div>

      <Line label="ID">
        <div className="flex items-center gap-x-2 overflow-hidden">
          <Avatar size="2xsmall" fallback={fallback} />
          <Text size="small" leading="compact" className="text-ui-fg-subtle truncate">
            {name || email || "Guest"}
          </Text>
        </div>
      </Line>

      <Line label="Contact">
        <div className="flex flex-col gap-y-2">
          <div className="grid grid-cols-[1fr_20px] items-start gap-x-2">
            <Text size="small" leading="compact" className="text-pretty break-all">
              {email}
            </Text>
            <div className="flex justify-end">
              <Copy content={email} className="text-ui-fg-muted" />
            </div>
          </div>
          {phone && (
            <div className="grid grid-cols-[1fr_20px] items-start gap-x-2">
              <Text size="small" leading="compact" className="text-pretty break-all">
                {phone}
              </Text>
              <div className="flex justify-end">
                <Copy content={phone} className="text-ui-fg-muted" />
              </div>
            </div>
          )}
        </div>
      </Line>

      {company && (
        <Line label="Company">
          <Text size="small" leading="compact" className="truncate">
            {company}
          </Text>
        </Line>
      )}

      <div className="divide-y">
        <AddressPrint label="Shipping address" address={shipping} />
        {!isSameAddress(shipping, billing) ? (
          <AddressPrint label="Billing address" address={billing} />
        ) : (
          <Line label="Billing address">
            <Text size="small" leading="compact" className="text-ui-fg-muted">
              Same as shipping address
            </Text>
          </Line>
        )}
      </div>
    </Container>
  )
}
