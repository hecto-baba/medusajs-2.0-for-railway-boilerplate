"use client"

import {
  createVendorBooking,
  getVendorSlotsPreview,
  listVendorResources,
  listVendorResourceServices,
} from "@lib/data/vendor-client"
import {
  Button,
  FocusModal,
  Input,
  Label,
  Select,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { addDaysToKey, formatTime, localDateKey, todayKey } from "../lib/format"

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-y-1">
    <Label size="small" weight="plus">{label}</Label>
    {children}
  </div>
)

/**
 * Records a booking for someone who phoned or walked in. The times offered are
 * exactly the ones a buyer could book, so hours, holidays and capacity still
 * apply; the booking is confirmed immediately and nothing is charged here.
 */
export const NewBookingModal = ({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) => {
  const queryClient = useQueryClient()
  const [resourceId, setResourceId] = useState("")
  const [productId, setProductId] = useState("")
  const [date, setDate] = useState("")
  const [start, setStart] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [notes, setNotes] = useState("")

  const resources = useQuery({
    queryKey: ["vendor-resources"],
    queryFn: listVendorResources,
    enabled: open,
  })
  const resource = resources.data?.resources.find((r) => r.id === resourceId)
  const timezone = resource?.timezone ?? "UTC"

  const services = useQuery({
    queryKey: ["vendor-resource-services", resourceId],
    queryFn: () => listVendorResourceServices(resourceId),
    enabled: open && !!resourceId,
  })

  // A little either side of the chosen day, because the day boundary is in the
  // resource's timezone, not the browser's; slots are filtered to the day below.
  const slots = useQuery({
    queryKey: ["vendor-booking-slots", resourceId, productId, date],
    queryFn: () =>
      getVendorSlotsPreview(resourceId, {
        product_id: productId,
        from: new Date(`${addDaysToKey(date, -1)}T00:00:00Z`).toISOString(),
        to: new Date(`${addDaysToKey(date, 2)}T00:00:00Z`).toISOString(),
      }),
    enabled: open && !!resourceId && !!productId && !!date,
  })
  const daySlots = (slots.data?.slots ?? []).filter(
    (s) => localDateKey(s.start, timezone) === date && s.capacity_remaining > 0
  )

  // Default to the first resource once they load, and to today in its timezone.
  useEffect(() => {
    if (!resourceId && resources.data?.resources.length) {
      setResourceId(resources.data.resources[0].id)
    }
  }, [resources.data, resourceId])
  useEffect(() => {
    if (resource && !date) setDate(todayKey(resource.timezone ?? "UTC"))
  }, [resource, date])
  useEffect(() => {
    setProductId("")
    setStart("")
  }, [resourceId])
  useEffect(() => setStart(""), [productId, date])

  const reset = () => {
    setResourceId("")
    setProductId("")
    setDate("")
    setStart("")
    setName("")
    setEmail("")
    setPhone("")
    setNotes("")
  }

  const create = useMutation({
    mutationFn: () =>
      createVendorBooking({
        resource_id: resourceId,
        product_id: productId,
        start,
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Booking added")
      queryClient.invalidateQueries({ queryKey: ["vendor-bookings"] })
      reset()
      onClose()
    },
    onError: (e: any) => {
      toast.error(e?.message || "Could not add the booking")
      // The time may have just been taken; refresh what is on offer.
      queryClient.invalidateQueries({ queryKey: ["vendor-booking-slots"] })
      setStart("")
    },
  })

  const offered = services.data?.services ?? []
  const emailOk = !email.trim() || /^\S+@\S+\.\S+$/.test(email.trim())
  const ready = !!resourceId && !!productId && !!start && !!name.trim() && emailOk

  return (
    <FocusModal
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <FocusModal.Content>
        <FocusModal.Header>
          <FocusModal.Title>New booking</FocusModal.Title>
        </FocusModal.Header>
        <FocusModal.Body className="mx-auto flex w-full max-w-lg flex-col gap-y-4 overflow-y-auto py-8">
          <Text size="small" className="text-ui-fg-subtle">
            For a customer who phoned or walked in. The booking is confirmed straight
            away. Nothing is charged here and no confirmation email is sent.
          </Text>

          <Field label="Resource">
            <Select value={resourceId} onValueChange={setResourceId}>
              <Select.Trigger><Select.Value placeholder="Choose a resource" /></Select.Trigger>
              <Select.Content>
                {(resources.data?.resources ?? []).map((r) => (
                  <Select.Item key={r.id} value={r.id}>{r.display_name}</Select.Item>
                ))}
              </Select.Content>
            </Select>
          </Field>

          <Field label="Service">
            <Select value={productId} onValueChange={setProductId} disabled={!resourceId}>
              <Select.Trigger>
                <Select.Value
                  placeholder={
                    services.isLoading
                      ? "Loading..."
                      : offered.length
                        ? "Choose a service"
                        : "This resource offers no services"
                  }
                />
              </Select.Trigger>
              <Select.Content>
                {offered.map((s) => (
                  <Select.Item key={s.product_id} value={s.product_id}>
                    {s.product?.title ?? s.product_id}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </Field>

          <Field label={`Date (${timezone})`}>
            <Input
              type="date"
              value={date}
              min={resource ? todayKey(timezone) : undefined}
              onChange={(e) => setDate(e.target.value)}
              disabled={!productId}
            />
          </Field>

          <Field label="Time">
            <Select value={start} onValueChange={setStart} disabled={!productId || !date}>
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
          </Field>

          <Field label="Customer name *">
            <Input value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-x-3">
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Phone">
              <Input value={phone} maxLength={50} onChange={(e) => setPhone(e.target.value)} />
            </Field>
          </div>
          {!emailOk ? (
            <Text size="small" className="text-ui-fg-error">
              Enter a valid email address or leave it empty.
            </Text>
          ) : null}
          <Field label="Notes">
            <Textarea value={notes} maxLength={1000} rows={3} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </FocusModal.Body>
        <FocusModal.Footer>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!ready || create.isPending}
            isLoading={create.isPending}
            onClick={() => create.mutate()}
          >
            Add booking
          </Button>
        </FocusModal.Footer>
      </FocusModal.Content>
    </FocusModal>
  )
}
