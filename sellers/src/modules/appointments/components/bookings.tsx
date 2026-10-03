"use client"

import {
  cancelVendorBooking,
  completeVendorBooking,
  listVendorBookings,
  listVendorResources,
  type VendorBooking,
  type VendorBookingAttendee,
} from "@lib/data/vendor-client"
import {
  Badge,
  Button,
  Container,
  FocusModal,
  Heading,
  Input,
  Label,
  Select,
  Table,
  Text,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { formatInZone, formatSlotDateTime, formatTime } from "../lib/format"
import { NewBookingModal } from "./new-booking-modal"

const PAGE_SIZE = 20
const EXPORT_PAGE_SIZE = 100

/**
 * One CSV cell. A value starting with = + - or @ is treated as a formula by
 * spreadsheet apps, and customers type these fields, so it is prefixed with an
 * apostrophe to keep it as text.
 */
const csvCell = (value: unknown): string => {
  let text = value === null || value === undefined ? "" : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text
  return /[",\n\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text
}

const CSV_HEADER = [
  "Date",
  "Start",
  "End",
  "Timezone",
  "Service",
  "Resource",
  "Customer",
  "Email",
  "Phone",
  "Notes",
  "Status",
  "Source",
  "Order",
  "Cancel reason",
]

/** One row per attendee, so a group slot exports one line per person. */
const bookingRows = (b: VendorBooking): string[][] => {
  const zone = b.resource.timezone
  return b.attendees
    .filter((a) => a.status !== "reserved")
    .map((a) => [
      formatInZone(b.start_time, zone, { year: "numeric", month: "2-digit", day: "2-digit" }),
      formatTime(b.start_time, zone),
      formatTime(b.end_time, zone),
      zone ?? "",
      b.service.title ?? "",
      b.resource.display_name ?? "",
      a.buyer_name ?? "",
      a.buyer_email ?? "",
      a.buyer_phone ?? "",
      a.notes ?? "",
      a.status === "cancelled" ? "Cancelled" : b.status === "completed" ? "Completed" : "Confirmed",
      a.order_id ? "Online" : "Entered by seller",
      a.order_id ?? "",
      a.cancel_reason ?? "",
    ])
}

const CancelModal = ({
  target,
  onClose,
}: {
  target: { booking: VendorBooking; attendee: VendorBookingAttendee } | null
  onClose: () => void
}) => {
  const queryClient = useQueryClient()
  const [reason, setReason] = useState("")

  const cancel = useMutation({
    mutationFn: () => cancelVendorBooking(target!.attendee.id, reason.trim()),
    onSuccess: () => {
      toast.success("Booking cancelled")
      queryClient.invalidateQueries({ queryKey: ["vendor-bookings"] })
      setReason("")
      onClose()
    },
    onError: (e: any) => toast.error(e?.message || "Could not cancel the booking"),
  })

  const tz = target?.booking.resource.timezone

  return (
    <FocusModal open={!!target} onOpenChange={(open) => !open && onClose()}>
      <FocusModal.Content>
        <FocusModal.Header>
          <FocusModal.Title>Cancel booking</FocusModal.Title>
        </FocusModal.Header>
        <FocusModal.Body className="flex flex-col items-center py-8">
          {target ? (
            <div className="flex w-full max-w-lg flex-col gap-y-4">
              <Text size="small">
                Cancel {target.attendee.buyer_name || "this customer"}&rsquo;s booking on{" "}
                <strong>{formatSlotDateTime(target.booking.start_time, tz)}</strong>?
              </Text>
              <div className="flex flex-col gap-y-1">
                <Label size="small" weight="plus">Reason (shown in your records)</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
              </div>
              <div className="bg-ui-bg-subtle rounded-md p-3">
                <Text size="small" className="text-ui-fg-subtle">
                  The place is released straight away. <strong>No refund is issued
                  automatically</strong> - refund the order from Orders if you need to.
                </Text>
              </div>
            </div>
          ) : null}
        </FocusModal.Body>
        <FocusModal.Footer>
          <div className="flex gap-x-2">
            <Button variant="secondary" onClick={onClose}>Keep booking</Button>
            <Button
              variant="danger"
              onClick={() => cancel.mutate()}
              disabled={!reason.trim() || cancel.isPending}
              isLoading={cancel.isPending}
            >
              Cancel booking
            </Button>
          </div>
        </FocusModal.Footer>
      </FocusModal.Content>
    </FocusModal>
  )
}

export const Bookings = () => {
  const queryClient = useQueryClient()
  const [resourceId, setResourceId] = useState("all")
  const [when, setWhen] = useState<"upcoming" | "past">("upcoming")
  const [offset, setOffset] = useState(0)
  const [creating, setCreating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<{
    booking: VendorBooking
    attendee: VendorBookingAttendee
  } | null>(null)

  const resources = useQuery({ queryKey: ["vendor-resources"], queryFn: listVendorResources })

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["vendor-bookings", resourceId, when, offset],
    queryFn: () =>
      listVendorBookings({
        resource_id: resourceId === "all" ? undefined : resourceId,
        status: when,
        limit: PAGE_SIZE,
        offset,
      }),
  })

  const complete = useMutation({
    mutationFn: (id: string) => completeVendorBooking(id),
    onSuccess: () => {
      toast.success("Marked as completed")
      queryClient.invalidateQueries({ queryKey: ["vendor-bookings"] })
    },
    onError: (e: any) => toast.error(e?.message || "Could not mark as completed"),
  })

  const bookings = data?.appointments ?? []
  const count = data?.count ?? 0

  // Exports what the filters above are showing, every page of it.
  const exportCsv = async () => {
    setExporting(true)
    try {
      const rows: string[][] = []
      for (let at = 0; ; at += EXPORT_PAGE_SIZE) {
        const page = await listVendorBookings({
          resource_id: resourceId === "all" ? undefined : resourceId,
          status: when,
          limit: EXPORT_PAGE_SIZE,
          offset: at,
        })
        page.appointments.forEach((b) => rows.push(...bookingRows(b)))
        if (at + EXPORT_PAGE_SIZE >= page.count || !page.appointments.length) break
      }
      if (!rows.length) {
        toast.info("There are no bookings to export.")
        return
      }
      const csv = [CSV_HEADER, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n")
      // The BOM makes Excel read the file as UTF-8, so names with accents survive.
      const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }))
      const link = document.createElement("a")
      link.href = url
      link.download = `bookings-${when}-${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      URL.revokeObjectURL(url)
      toast.success(`Exported ${rows.length} booking${rows.length === 1 ? "" : "s"}`)
    } catch (e: any) {
      toast.error(e?.message || "Could not export the bookings")
    } finally {
      setExporting(false)
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-wrap items-end justify-between gap-4 px-6 py-4">
        <div>
          <Heading level="h1">Bookings</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Confirmed appointments. Times are in each resource&rsquo;s own timezone.
          </Text>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Button size="small" variant="secondary" onClick={exportCsv} isLoading={exporting} disabled={exporting}>
            Export CSV
          </Button>
          <Button size="small" onClick={() => setCreating(true)}>
            New booking
          </Button>
          <div className="flex flex-col gap-y-1">
            <Label size="small" weight="plus">Resource</Label>
            <Select
              value={resourceId}
              onValueChange={(v) => {
                setResourceId(v)
                setOffset(0)
              }}
            >
              <Select.Trigger className="w-48"><Select.Value /></Select.Trigger>
              <Select.Content>
                <Select.Item value="all">All resources</Select.Item>
                {(resources.data?.resources ?? []).map((r) => (
                  <Select.Item key={r.id} value={r.id}>{r.display_name}</Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
          <div className="flex flex-col gap-y-1">
            <Label size="small" weight="plus">Show</Label>
            <Select
              value={when}
              onValueChange={(v) => {
                setWhen(v as "upcoming" | "past")
                setOffset(0)
              }}
            >
              <Select.Trigger className="w-36"><Select.Value /></Select.Trigger>
              <Select.Content>
                <Select.Item value="upcoming">Upcoming</Select.Item>
                <Select.Item value="past">Past</Select.Item>
              </Select.Content>
            </Select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="px-6 py-8"><Text size="small" className="text-ui-fg-subtle">Loading...</Text></div>
      ) : isError ? (
        <div className="px-6 py-8"><Text size="small" className="text-ui-fg-error">{(error as Error)?.message}</Text></div>
      ) : !bookings.length ? (
        <div className="px-6 py-12 text-center">
          <Text size="small" className="text-ui-fg-subtle">
            No {when} bookings{resourceId !== "all" ? " for this resource" : ""}.
          </Text>
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>When</Table.HeaderCell>
              <Table.HeaderCell>Service</Table.HeaderCell>
              <Table.HeaderCell>Resource</Table.HeaderCell>
              <Table.HeaderCell>Customer</Table.HeaderCell>
              <Table.HeaderCell>Booked</Table.HeaderCell>
              <Table.HeaderCell />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {bookings.map((b) => {
              const active = b.attendees.filter((a) => a.status === "confirmed")
              const tz = b.resource.timezone
              const started = new Date(b.start_time).getTime() <= Date.now()
              return (
                <Table.Row key={b.id} className="align-top">
                  <Table.Cell>
                    <Text size="small" weight="plus">{formatSlotDateTime(b.start_time, tz)}</Text>
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      until {formatTime(b.end_time, tz)}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>{b.service.title ?? "-"}</Table.Cell>
                  <Table.Cell>{b.resource.display_name ?? "-"}</Table.Cell>
                  <Table.Cell>
                    <div className="flex flex-col gap-y-2">
                      {b.attendees.map((a) => (
                        <div key={a.id} className="flex flex-col">
                          <div className="flex items-center gap-x-2">
                            <Text size="small" weight="plus">{a.buyer_name || "Guest"}</Text>
                            {a.status === "cancelled" ? (
                              <Badge size="2xsmall" color="red">Cancelled</Badge>
                            ) : a.status === "reserved" ? (
                              <Badge size="2xsmall" color="orange">Awaiting payment</Badge>
                            ) : null}
                          </div>
                          <Text size="xsmall" className="text-ui-fg-subtle">
                            {[a.buyer_email, a.buyer_phone].filter(Boolean).join(" · ")}
                          </Text>
                          {a.notes ? <Text size="xsmall" className="text-ui-fg-subtle">“{a.notes}”</Text> : null}
                          {a.status === "cancelled" && a.cancel_reason ? (
                            <Text size="xsmall" className="text-ui-fg-muted">
                              {a.cancelled_by}: {a.cancel_reason}
                            </Text>
                          ) : null}
                          {a.status === "confirmed" ? (
                            <button
                              type="button"
                              className="text-ui-fg-error txt-compact-xsmall w-fit"
                              onClick={() => setCancelTarget({ booking: b, attendee: a })}
                            >
                              Cancel
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    {active.length} / {b.max_capacity}
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      {formatInZone(b.start_time, tz, { timeZoneName: "short" }).split(" ").pop()}
                    </Text>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    {b.status === "completed" ? (
                      <Badge size="2xsmall" color="green">Completed</Badge>
                    ) : started && active.length ? (
                      <Button
                        size="small"
                        variant="secondary"
                        onClick={() => complete.mutate(b.id)}
                        disabled={complete.isPending}
                      >
                        Mark completed
                      </Button>
                    ) : null}
                  </Table.Cell>
                </Table.Row>
              )
            })}
          </Table.Body>
        </Table>
      )}

      {count > PAGE_SIZE ? (
        <div className="flex items-center justify-between px-6 py-3">
          <Text size="small" className="text-ui-fg-subtle">
            {offset + 1}-{Math.min(offset + PAGE_SIZE, count)} of {count}
          </Text>
          <div className="flex gap-x-2">
            <Button size="small" variant="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
              Previous
            </Button>
            <Button size="small" variant="secondary" disabled={offset + PAGE_SIZE >= count} onClick={() => setOffset(offset + PAGE_SIZE)}>
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <CancelModal target={cancelTarget} onClose={() => setCancelTarget(null)} />
      <NewBookingModal open={creating} onClose={() => setCreating(false)} />
    </Container>
  )
}
