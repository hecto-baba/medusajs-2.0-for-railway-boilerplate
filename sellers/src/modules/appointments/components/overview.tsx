"use client"

import { getVendorBookingOverview } from "@lib/data/vendor-client"
import { ArrowRight, Calendar, CubeSolid, Plus, ShoppingCart, Users } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Table, Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useState } from "react"
import { formatSlotDateTime, money } from "../lib/format"
import { NewBookingModal } from "./new-booking-modal"

const STATUS_COLOR = {
  confirmed: "green",
  completed: "blue",
  cancelled: "red",
} as const

const StatCard = ({
  label,
  value,
  change,
  loading,
}: {
  label: string
  value: number
  /** Month-on-month change; omitted for a card with no trend. */
  change?: number
  loading: boolean
}) => (
  <Container className="flex items-start justify-between p-6">
    <div className="flex flex-col gap-y-2">
      <Text size="base" className="text-ui-fg-subtle">{label}</Text>
      <Heading level="h1">{loading ? "-" : value}</Heading>
      {change !== undefined ? (
        <Text size="small" className="text-ui-fg-subtle">
          <span className={change < 0 ? "text-ui-fg-error" : "text-ui-fg-interactive"}>
            {change < 0 ? "" : "+"}
            {change}
          </span>{" "}
          from last month
        </Text>
      ) : null}
    </div>
    <div className="bg-ui-bg-subtle flex h-10 w-10 items-center justify-center rounded-full border">
      <Calendar className="text-ui-fg-subtle" />
    </div>
  </Container>
)

const QuickAction = ({
  href,
  icon,
  children,
}: {
  href: string
  icon: React.ReactNode
  children: React.ReactNode
}) => (
  <Button variant="secondary" asChild className="w-full justify-start">
    <Link href={href}>
      {icon}
      {children}
    </Link>
  </Button>
)

/**
 * The Booking landing page: headline counts with their change since last month,
 * the most recent bookings, and the everyday actions one click away. Counts are
 * booked time slots, so a group session with several people counts once.
 */
export const Overview = () => {
  const [creating, setCreating] = useState(false)
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["vendor-bookings", "overview"],
    queryFn: getVendorBookingOverview,
  })

  const stats = data?.stats
  const recent = data?.recent ?? []

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Heading level="h1">Booking Overview</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Welcome to your booking management dashboard.
          </Text>
        </div>
        <div className="flex gap-x-2">
          <Button variant="secondary" onClick={() => setCreating(true)}>
            <Plus /> New Booking
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/appointments/resources">
              <Plus /> New Resource
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active Bookings" value={stats?.active.count ?? 0} change={stats?.active.change ?? 0} loading={isLoading} />
        <StatCard label="Upcoming Bookings" value={stats?.upcoming.count ?? 0} change={stats?.upcoming.change ?? 0} loading={isLoading} />
        <StatCard label="Past Bookings" value={stats?.past.count ?? 0} loading={isLoading} />
        <StatCard label="Pending Bookings" value={stats?.pending.count ?? 0} change={stats?.pending.change ?? 0} loading={isLoading} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Container className="divide-y p-0 xl:col-span-2">
          <div className="flex items-center justify-between px-6 py-4">
            <Heading level="h2">Recent Bookings</Heading>
            <Link href="/appointments/bookings" className="text-ui-fg-interactive txt-small inline-flex items-center gap-x-1">
              View All <ArrowRight />
            </Link>
          </div>
          {isLoading ? (
            <div className="px-6 py-8"><Text size="small" className="text-ui-fg-subtle">Loading...</Text></div>
          ) : isError ? (
            <div className="px-6 py-8">
              <Text size="small" className="text-ui-fg-error">{(error as Error)?.message}</Text>
            </div>
          ) : !recent.length ? (
            <div className="px-6 py-10 text-center">
              <Text size="small" className="text-ui-fg-subtle">No bookings found</Text>
            </div>
          ) : (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Booking #</Table.HeaderCell>
                  <Table.HeaderCell>Order ID</Table.HeaderCell>
                  <Table.HeaderCell>Customer</Table.HeaderCell>
                  <Table.HeaderCell>Start Date</Table.HeaderCell>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                  <Table.HeaderCell className="text-right">Amount</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {recent.map((r) => (
                  <Table.Row key={r.id}>
                    <Table.Cell>#{r.booking_ref}</Table.Cell>
                    <Table.Cell>
                      {r.order_id ? (
                        <Link href={`/orders/${r.order_id}`} className="text-ui-fg-interactive">
                          #{r.order_display_id ?? r.order_id.slice(-6)}
                        </Link>
                      ) : (
                        <span className="text-ui-fg-muted" title="Entered by you; no order">-</span>
                      )}
                    </Table.Cell>
                    <Table.Cell>{r.customer || "-"}</Table.Cell>
                    <Table.Cell>{formatSlotDateTime(r.start_time, r.timezone)}</Table.Cell>
                    <Table.Cell>
                      <Badge size="2xsmall" color={STATUS_COLOR[r.status]}>
                        {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      {r.amount === null ? "-" : money(r.amount, r.currency_code)}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          )}
        </Container>

        <Container className="divide-y p-0">
          <div className="px-6 py-4"><Heading level="h2">Quick Actions</Heading></div>
          <div className="flex flex-col gap-y-2 p-4">
            <QuickAction href="/appointments/resources" icon={<CubeSolid />}>Manage Resources</QuickAction>
            <QuickAction href="/orders" icon={<ShoppingCart />}>View Orders</QuickAction>
            <QuickAction href="/customers" icon={<Users />}>Manage Customers</QuickAction>
          </div>
        </Container>
      </div>

      <NewBookingModal open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}
