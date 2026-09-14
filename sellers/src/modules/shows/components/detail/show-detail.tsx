"use client"

import {
  deleteVendorShow,
  getVendorShow,
  getVendorShowSeats,
  scanVendorTicketPurchase,
  type VendorSeatMapRow,
  type VendorShow,
  type VendorTicketPurchase,
} from "@lib/data/vendor-client"
import { ActionMenu, SectionRow, Thumbnail } from "@modules/common"
import { useBreadcrumbTitle } from "@modules/layout"
import { ROW_TYPE_STYLES } from "@modules/venues/components/common/seat-chart"
import {
  ArrowLeft,
  Buildings,
  Calendar,
  CheckCircle,
  CurrencyDollar,
  MagnifyingGlass,
  Sparkles,
  Trash,
  Users,
} from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Table,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"

type ShowDetailProps = {
  id: string
}

export const ShowDetail = ({ id }: ShowDetailProps) => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const { data, isLoading, error } = useQuery({
    queryKey: ["vendor-show", id],
    queryFn: () => getVendorShow(id),
  })

  const show = data?.show

  useBreadcrumbTitle(show?.product?.title)

  const dates = show?.dates ?? []
  const [selectedDate, setSelectedDate] = useState<string>("")
  const [attendeeSearch, setAttendeeSearch] = useState("")

  // Set default selected date once show loads
  const activeDate = selectedDate || dates[0] || ""

  // Fetch seat map for active date
  const { data: seatMapData, isLoading: isLoadingSeats } = useQuery({
    queryKey: ["vendor-show-seats", id, activeDate],
    queryFn: () => getVendorShowSeats(id, activeDate),
    enabled: !!id && !!activeDate,
  })

  const deleteMutation = useMutation({
    mutationFn: (showId: string) => deleteVendorShow(showId),
    onSuccess: () => {
      toast.success("Show deleted successfully")
      queryClient.invalidateQueries({ queryKey: ["vendor-shows"] })
      router.push("/shows")
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete show")
    },
  })

  const scanMutation = useMutation({
    mutationFn: (purchaseId: string) => scanVendorTicketPurchase(id, purchaseId),
    onSuccess: (res) => {
      toast.success(res.message || "Ticket status updated")
      queryClient.invalidateQueries({ queryKey: ["vendor-show", id] })
      queryClient.invalidateQueries({ queryKey: ["vendor-show-seats", id, activeDate] })
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update ticket status")
    },
  })

  const handleDelete = async () => {
    if (!show) return

    const confirmed = await prompt({
      title: "Delete Show",
      description: `Are you sure you want to delete "${show.product?.title || "this show"}"? This will cancel all performance dates.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
    })

    if (confirmed) {
      deleteMutation.mutate(show.id)
    }
  }

  const handleScanToggle = (purchaseId: string) => {
    scanMutation.mutate(purchaseId)
  }

  const purchases = (show?.purchases || []) as VendorTicketPurchase[]

  // Filter purchases for active date + attendee search
  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      const matchesDate =
        !activeDate ||
        (p.show_date &&
          new Date(p.show_date).toDateString() ===
            new Date(activeDate).toDateString())

      if (!matchesDate) return false

      if (!attendeeSearch.trim()) return true
      const q = attendeeSearch.toLowerCase()
      return (
        p.seat_number.toLowerCase().includes(q) ||
        p.order_id.toLowerCase().includes(q) ||
        p.venue_row?.row_number?.toLowerCase().includes(q)
      )
    })
  }, [purchases, activeDate, attendeeSearch])

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Text size="small" className="text-ui-fg-subtle">
          Loading show details...
        </Text>
      </div>
    )
  }

  if (error || !show) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-y-4">
        <Text size="small" className="text-ui-fg-error">
          Show not found or access denied.
        </Text>
        <Link href="/shows">
          <Button variant="secondary" size="small">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Shows
          </Button>
        </Link>
      </div>
    )
  }

  const activePerformance = (show.performances || []).find(
    (perf) =>
      new Date(perf.date).toDateString() === new Date(activeDate).toDateString()
  )

  const seatMapRows = seatMapData?.seat_map || []

  return (
    <div className="flex flex-col gap-y-6 pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-x-4">
          <Link href="/shows">
            <Button variant="secondary" size="small">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-x-2">
              <Heading level="h1">
                {show.product?.title || "Untitled Show"}
              </Heading>
              {show.venue && (
                <Link href={`/venues/${show.venue_id}`}>
                  <Badge size="small" color="purple" className="hover:opacity-80">
                    <Buildings className="h-3 w-3 mr-1" />
                    {show.venue.name}
                  </Badge>
                </Link>
              )}
              <Badge size="small" color="blue">
                {dates.length} {dates.length === 1 ? "performance" : "performances"}
              </Badge>
            </div>
            {show.product?.description && (
              <Text size="small" className="text-ui-fg-subtle mt-0.5 line-clamp-1">
                {show.product.description}
              </Text>
            )}
          </div>
        </div>

        <div className="flex items-center gap-x-2">
          {show.product_id && (
            <Link href={`/products/${show.product_id}`}>
              <Button variant="secondary" size="small">
                View Product
              </Button>
            </Link>
          )}
          <ActionMenu
            groups={[
              {
                actions: [
                  {
                    label: "Delete Show",
                    icon: <Trash className="h-4 w-4 text-ui-fg-error" />,
                    onClick: handleDelete,
                  },
                ],
              },
            ]}
          />
        </div>
      </div>

      {/* Overview Container */}
      <Container className="p-6">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-x-3">
            <Thumbnail src={show.product?.thumbnail} />
            <div>
              <Heading level="h2">Show Information</Heading>
              <Text size="small" className="text-ui-fg-subtle">
                Event schedule, location, and seating tiers
              </Text>
            </div>
          </div>
        </div>

        <div className="flex flex-col divide-y pt-2">
          <SectionRow
            title="Venue Location"
            value={
              show.venue ? (
                <Link
                  href={`/venues/${show.venue_id}`}
                  className="font-medium text-ui-fg-interactive hover:underline"
                >
                  {show.venue.name} {show.venue.address ? `(${show.venue.address})` : ""}
                </Link>
              ) : (
                "-"
              )
            }
          />
          <SectionRow
            title="Total Performances"
            value={`${dates.length} scheduled show dates`}
          />
          <SectionRow
            title="Available Seating Tiers"
            value={
              <div className="flex flex-wrap gap-1.5">
                {(show.tiers || []).map((tier) => {
                  const style =
                    ROW_TYPE_STYLES[tier] ?? ROW_TYPE_STYLES.standard
                  return (
                    <Badge key={tier} size="small" color={style.badgeColor}>
                      {style.label}
                    </Badge>
                  )
                })}
              </div>
            }
          />
          <SectionRow
            title="Created Date"
            value={
              show.created_at
                ? new Date(show.created_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : "-"
            }
          />
        </div>
      </Container>

      {/* Performance Date Selector & Live Seat Map Section */}
      <Container className="p-6">
        <div className="flex items-center justify-between border-b pb-4 mb-6">
          <div>
            <Heading level="h2">Performance Seat Map & Availability</Heading>
            <Text size="small" className="text-ui-fg-subtle mt-0.5">
              Select a performance date to view real-time booked seats and check in attendees.
            </Text>
          </div>
        </div>

        {/* Dates Pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          {dates.map((dateStr) => {
            const isActive =
              new Date(dateStr).toDateString() ===
              new Date(activeDate).toDateString()

            const perf = (show.performances || []).find(
              (p) =>
                new Date(p.date).toDateString() ===
                new Date(dateStr).toDateString()
            )

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => setSelectedDate(dateStr)}
                className={`flex flex-col items-start px-4 py-2 rounded-lg border transition-all text-left ${
                  isActive
                    ? "bg-ui-bg-base border-ui-border-interactive shadow-elevation-card-hover ring-2 ring-ui-border-interactive/20"
                    : "bg-ui-bg-subtle/50 hover:bg-ui-bg-subtle border-ui-border-base"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-ui-fg-subtle" />
                  <Text size="small" weight={isActive ? "plus" : "regular"}>
                    {new Date(dateStr).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>
                </div>
                {perf && (
                  <Text size="xsmall" className="text-ui-fg-subtle mt-0.5">
                    {perf.sold_count} / {perf.capacity} booked
                  </Text>
                )}
              </button>
            )
          })}
        </div>

        {/* Active Performance Stats Cards */}
        {activePerformance && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-ui-bg-subtle p-4 rounded-lg border border-ui-border-base">
              <Text size="xsmall" className="text-ui-fg-subtle">
                Total Capacity
              </Text>
              <Heading level="h3" className="text-ui-fg-base mt-1">
                {activePerformance.capacity}
              </Heading>
            </div>
            <div className="bg-ui-bg-subtle p-4 rounded-lg border border-ui-border-base">
              <Text size="xsmall" className="text-ui-fg-subtle">
                Tickets Sold
              </Text>
              <Heading level="h3" className="text-ui-fg-interactive mt-1">
                {activePerformance.sold_count}
              </Heading>
            </div>
            <div className="bg-ui-bg-subtle p-4 rounded-lg border border-ui-border-base">
              <Text size="xsmall" className="text-ui-fg-subtle">
                Available Seats
              </Text>
              <Heading level="h3" className="text-ui-fg-base mt-1">
                {activePerformance.available_count}
              </Heading>
            </div>
            <div className="bg-ui-bg-subtle p-4 rounded-lg border border-ui-border-base">
              <Text size="xsmall" className="text-ui-fg-subtle">
                Checked-In Attendees
              </Text>
              <Heading level="h3" className="text-green-600 dark:text-green-400 mt-1">
                {activePerformance.scanned_count}
              </Heading>
            </div>
          </div>
        )}

        {/* Live Seating Chart Map */}
        <div className="bg-ui-bg-subtle border border-ui-border-base rounded-lg p-6 mb-8">
          {/* Stage Banner */}
          <div className="bg-ui-bg-component text-ui-fg-subtle mb-6 rounded py-1.5 text-center shadow-elevation-card-rest border border-ui-border-base">
            <Text size="xsmall" weight="plus" className="tracking-widest">
              STAGE / FRONT
            </Text>
          </div>

          {isLoadingSeats ? (
            <div className="py-12 text-center text-ui-fg-subtle text-sm">
              Loading real-time seat availability...
            </div>
          ) : !seatMapRows.length ? (
            <div className="py-12 text-center text-ui-fg-subtle text-sm">
              No seating rows configured for this venue.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {seatMapRows.map((row: VendorSeatMapRow) => {
                const style =
                  ROW_TYPE_STYLES[row.row_type] ?? ROW_TYPE_STYLES.standard

                return (
                  <div key={row.venue_row_id} className="flex items-center gap-3">
                    <div className="w-8 shrink-0 text-center font-bold">
                      <Text size="xsmall" weight="plus">
                        {row.row_number}
                      </Text>
                    </div>

                    <div className="flex flex-1 flex-wrap gap-1.5 items-center">
                      {row.seats.map((seat) => {
                        let seatClass = style.swatch
                        let statusLabel = `Available (${style.label})`

                        if (!seat.is_available) {
                          if (seat.status === "scanned") {
                            seatClass =
                              "bg-green-600 border-green-700 text-white font-bold"
                            statusLabel = `Checked In (Order: ${seat.order_id})`
                          } else {
                            seatClass =
                              "bg-ui-fg-base border-ui-fg-base text-ui-bg-base font-bold opacity-80"
                            statusLabel = `Booked (Order: ${seat.order_id})`
                          }
                        }

                        return (
                          <div
                            key={seat.seat_number}
                            className={`h-6 w-6 rounded border text-[10px] flex items-center justify-center font-mono cursor-pointer transition-transform hover:scale-110 select-none ${seatClass}`}
                            title={`Row ${row.row_number}, Seat ${seat.seat_number} — ${statusLabel}`}
                            onClick={() => {
                              if (seat.purchase_id) {
                                handleScanToggle(seat.purchase_id)
                              }
                            }}
                          >
                            {seat.seat_number}
                          </div>
                        )
                      })}
                    </div>

                    <div className="w-24 shrink-0 text-right">
                      <Text size="xsmall" className="text-ui-fg-subtle">
                        {style.label}
                      </Text>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Seat Map Legend */}
          <div className="border-t border-ui-border-base mt-6 pt-4 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <div className="h-4 w-4 rounded border bg-ui-bg-base border-ui-border-base" />
                <Text size="xsmall">Available</Text>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-4 w-4 rounded border bg-ui-fg-base border-ui-fg-base text-white text-[9px] flex items-center justify-center">
                  &bull;
                </div>
                <Text size="xsmall">Booked (Pending Check-in)</Text>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-4 w-4 rounded border bg-green-600 border-green-700 text-white text-[9px] flex items-center justify-center">
                  ✓
                </div>
                <Text size="xsmall">Checked In</Text>
              </div>
            </div>
            <Text size="xsmall" className="text-ui-fg-muted italic">
              Tip: Click on any booked seat to toggle check-in status.
            </Text>
          </div>
        </div>

        {/* Attendees & Ticket Purchases Table */}
        <div className="flex flex-col gap-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Heading level="h3">Attendee Ticket Purchases</Heading>
              <Text size="small" className="text-ui-fg-subtle">
                Customer bookings for performance on {new Date(activeDate).toLocaleDateString()}
              </Text>
            </div>

            <div className="w-64">
              <Input
                placeholder="Search seat, row, order..."
                value={attendeeSearch}
                onChange={(e) => setAttendeeSearch(e.target.value)}
              />
            </div>
          </div>

          <Container className="p-0 overflow-hidden border border-ui-border-base">
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Seat</Table.HeaderCell>
                  <Table.HeaderCell>Tier</Table.HeaderCell>
                  <Table.HeaderCell>Order</Table.HeaderCell>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                  <Table.HeaderCell className="text-right">Action</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {filteredPurchases.length === 0 ? (
                  <Table.Row>
                    <Table.Cell className="text-ui-fg-subtle italic py-6">
                      No ticket purchases found for this performance date.
                    </Table.Cell>
                    <Table.Cell />
                    <Table.Cell />
                    <Table.Cell />
                    <Table.Cell />
                  </Table.Row>
                ) : (
                  filteredPurchases.map((purchase) => {
                    const rowNumber = purchase.venue_row?.row_number || "-"
                    const rowType = purchase.venue_row?.row_type || "standard"
                    const style =
                      ROW_TYPE_STYLES[rowType] ?? ROW_TYPE_STYLES.standard
                    const isScanned = purchase.status === "scanned"

                    return (
                      <Table.Row key={purchase.id}>
                        <Table.Cell className="font-bold text-ui-fg-base">
                          Row {rowNumber}, Seat {purchase.seat_number}
                        </Table.Cell>
                        <Table.Cell>
                          <Badge size="small" color={style.badgeColor}>
                            {style.label}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell>
                          <Link
                            href={`/orders/${purchase.order_id}`}
                            className="text-ui-fg-interactive hover:underline text-xs font-mono"
                          >
                            #{purchase.order_id.slice(-8)}
                          </Link>
                        </Table.Cell>
                        <Table.Cell>
                          <Badge
                            size="small"
                            color={isScanned ? "green" : "grey"}
                          >
                            {isScanned ? "Checked In" : "Pending"}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell className="text-right">
                          <Button
                            size="small"
                            variant={isScanned ? "secondary" : "primary"}
                            onClick={() => handleScanToggle(purchase.id)}
                            isLoading={scanMutation.isPending}
                          >
                            {isScanned ? "Undo Check-In" : "Check In Attendee"}
                          </Button>
                        </Table.Cell>
                      </Table.Row>
                    )
                  })
                )}
              </Table.Body>
            </Table>
          </Container>
        </div>
      </Container>
    </div>
  )
}
