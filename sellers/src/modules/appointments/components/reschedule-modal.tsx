"use client"

import {
  getVendorRescheduleSlots,
  rescheduleVendorBooking,
  type VendorBooking,
  type VendorBookingAttendee,
} from "@lib/data/vendor-client"
import { Button, Checkbox, FocusModal, Input, Label, Select, Text, toast } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import {
  addDaysToKey,
  formatSlotDateTime,
  formatTime,
  localDateKey,
  todayKey,
} from "../lib/format"

export type RescheduleTarget = {
  booking: VendorBooking
  attendee: VendorBookingAttendee
}

/**
 * Moves one customer's booking to another time on the same resource and service.
 * The times offered are the ones a buyer could book (hours, holidays, buffers and
 * capacity all apply), except that the minimum-notice rule is waived and the
 * booking's own neighbouring times are available. Nothing about payment changes.
 */
export const RescheduleModal = ({
  target,
  onClose,
}: {
  target: RescheduleTarget | null
  onClose: () => void
}) => {
  const queryClient = useQueryClient()
  const [date, setDate] = useState("")
  const [start, setStart] = useState("")
  const [notify, setNotify] = useState(true)

  const timezone = target?.booking.resource.timezone ?? "UTC"
  const attendeeId = target?.attendee.id
  const hasEmail = !!target?.attendee.buyer_email

  // Open on the booking's current day, in the resource's timezone.
  useEffect(() => {
    if (target) {
      setDate(localDateKey(target.booking.start_time, timezone))
      setStart("")
      setNotify(!!target.attendee.buyer_email)
    }
  }, [target, timezone])

  // A little either side of the chosen day, because the day boundary is in the
  // resource's timezone, not the browser's; slots are filtered to the day below.
  const slots = useQuery({
    queryKey: ["vendor-reschedule-slots", attendeeId, date],
    queryFn: () =>
      getVendorRescheduleSlots(attendeeId!, {
        from: new Date(`${addDaysToKey(date, -1)}T00:00:00Z`).toISOString(),
        to: new Date(`${addDaysToKey(date, 2)}T00:00:00Z`).toISOString(),
      }),
    enabled: !!attendeeId && !!date,
  })
  const daySlots = (slots.data?.slots ?? []).filter(
    (s) => localDateKey(s.start, timezone) === date && s.capacity_remaining > 0
  )

  useEffect(() => setStart(""), [date])

  const move = useMutation({
    mutationFn: () => rescheduleVendorBooking(attendeeId!, start, notify && hasEmail),
    onSuccess: () => {
      toast.success("Booking rescheduled")
      queryClient.invalidateQueries({ queryKey: ["vendor-bookings"] })
      onClose()
    },
    onError: (e: any) => {
      toast.error(e?.message || "Could not reschedule the booking")
      // The time may have just been taken; refresh what is on offer.
      queryClient.invalidateQueries({ queryKey: ["vendor-reschedule-slots"] })
      setStart("")
    },
  })

  return (
    <FocusModal open={!!target} onOpenChange={(open) => !open && onClose()}>
      <FocusModal.Content>
        <FocusModal.Header>
          <FocusModal.Title>Reschedule booking</FocusModal.Title>
        </FocusModal.Header>
        <FocusModal.Body className="mx-auto flex w-full max-w-lg flex-col gap-y-4 overflow-y-auto py-8">
          {target ? (
            <>
              <div className="bg-ui-bg-subtle flex flex-col gap-y-1 rounded-md p-3">
                <Text size="small" weight="plus">
                  {target.attendee.buyer_name || "Guest"}
                </Text>
                <Text size="small" className="text-ui-fg-subtle">
                  {target.booking.service.title ?? "Appointment"} ·{" "}
                  {target.booking.resource.display_name ?? "Resource"}
                </Text>
                <Text size="small" className="text-ui-fg-muted line-through">
                  {formatSlotDateTime(target.booking.start_time, timezone)}
                </Text>
              </div>

              <div className="grid grid-cols-2 gap-x-3">
                <div className="flex flex-col gap-y-1">
                  <Label size="small" weight="plus">{`Date (${timezone})`}</Label>
                  <Input
                    type="date"
                    value={date}
                    min={todayKey(timezone)}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-y-1">
                  <Label size="small" weight="plus">Time</Label>
                  <Select value={start} onValueChange={setStart} disabled={!date}>
                    <Select.Trigger>
                      <Select.Value
                        placeholder={
                          slots.isLoading
                            ? "Loading times..."
                            : daySlots.length
                              ? "Choose a time"
                              : "No free times on this day"
                        }
                      />
                    </Select.Trigger>
                    <Select.Content>
                      {daySlots.map((s) => (
                        <Select.Item key={s.start} value={s.start}>
                          {formatTime(s.start, timezone)} - {formatTime(s.end, timezone)}
                          {s.capacity > 1 ? ` (${s.capacity_remaining} places left)` : ""}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </div>
              </div>

              <div className="flex items-start gap-x-2">
                <Checkbox
                  id="reschedule-notify"
                  checked={notify && hasEmail}
                  disabled={!hasEmail}
                  onCheckedChange={(v) => setNotify(v === true)}
                />
                <div className="flex flex-col">
                  <Label htmlFor="reschedule-notify" size="small" weight="plus">
                    Email {target.attendee.buyer_name || "the customer"} about the new time
                  </Label>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {hasEmail
                      ? "Includes a link to change or cancel it again."
                      : "No email on file for this customer."}
                  </Text>
                </div>
              </div>

              <div className="bg-ui-bg-subtle rounded-md p-3">
                <Text size="small" className="text-ui-fg-subtle">
                  You are not limited by the customer&rsquo;s change window. Times offered follow
                  your hours, holidays and capacity. Payment does not change.
                </Text>
              </div>
            </>
          ) : null}
        </FocusModal.Body>
        <FocusModal.Footer>
          <Button variant="secondary" onClick={onClose}>Keep booking</Button>
          <Button
            disabled={!start || move.isPending}
            isLoading={move.isPending}
            onClick={() => move.mutate()}
          >
            Reschedule
          </Button>
        </FocusModal.Footer>
      </FocusModal.Content>
    </FocusModal>
  )
}
