import { Trash } from "@medusajs/icons"
import {
  Badge,
  Button,
  Checkbox,
  Container,
  FocusModal,
  Heading,
  IconButton,
  Input,
  Label,
  Select,
  Table,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { sdk } from "../lib/sdk"
import {
  addDaysToKey,
  formatInZone,
  formatSlotDateTime,
  formatTime,
  localDateKey,
} from "../lib/appointment-format"
import {
  Booking,
  BookingAttendee,
  BookingListResponse,
  OfferedService,
  PreviewSlot,
  Provider,
  RescheduleSlot,
} from "../types/appointment-booking"

/* ------------------------------------------------------------- services */

type Entry = { product_id: string; duration_minutes: number | null; capacity: number | null }

export const AppointmentServicesSection = ({ resource }: { resource: Provider }) => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const [adding, setAdding] = useState(false)
  const [productId, setProductId] = useState("")
  const [duration, setDuration] = useState("")
  const [capacity, setCapacity] = useState("")

  const key = [["admin-provider-services", resource.id]]

  const { data, isLoading } = useQuery<{ services: OfferedService[] }>({
    queryKey: key,
    queryFn: () => sdk.client.fetch(`/admin/providers/${resource.id}/services`),
  })

  const { data: productsData, isLoading: productsLoading } = useQuery<{
    products: { id: string; title: string }[]
  }>({
    queryKey: [["admin-products-for-services"]],
    queryFn: () => sdk.client.fetch("/admin/products", { query: { limit: 100, fields: "id,title" } }),
    enabled: adding,
  })

  const services = data?.services ?? []
  const toEntries = (list: OfferedService[]): Entry[] =>
    list.map((s) => ({ product_id: s.product_id, duration_minutes: s.duration_minutes, capacity: s.capacity }))

  const save = useMutation({
    mutationFn: (entries: Entry[]) =>
      sdk.client.fetch(`/admin/providers/${resource.id}/services`, {
        method: "POST",
        body: { services: entries },
      }),
    onSuccess: () => {
      toast.success("Services updated")
      queryClient.invalidateQueries({ queryKey: key })
      queryClient.invalidateQueries({ queryKey: [["admin-provider", resource.id]] })
      setAdding(false)
      setProductId("")
      setDuration("")
      setCapacity("")
    },
    onError: (e: any) => toast.error(e?.message || "Could not update services"),
  })

  const durationValue = duration.trim() === "" ? null : Number(duration)
  const capacityValue = capacity.trim() === "" ? null : Number(capacity)
  const problem = !productId
    ? "Choose a service."
    : durationValue !== null && (!Number.isInteger(durationValue) || durationValue < 1 || durationValue > 1440)
      ? "Session length must be 1-1440 minutes (or empty)."
      : capacityValue !== null && (!Number.isInteger(capacityValue) || capacityValue < 1)
        ? "People per slot must be at least 1 (or empty)."
        : null

  const remove = async (s: OfferedService) => {
    const ok = await prompt({
      title: "Stop offering this service?",
      description: `${s.product?.title ?? "This service"} will no longer be bookable with this resource. Existing bookings are not affected.`,
      variant: "danger",
    })
    if (ok) save.mutate(toEntries(services.filter((x) => x.id !== s.id)))
  }

  const available = (productsData?.products ?? []).filter(
    (p) => !services.some((s) => s.product_id === p.id)
  )

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">Services</Heading>
          <Text size="small" className="text-ui-fg-subtle">What can be booked with this resource. The price comes from the product.</Text>
        </div>
        <Button size="small" variant="secondary" onClick={() => setAdding(true)}>Offer a service</Button>
      </div>

      {isLoading ? (
        <div className="px-6 py-8"><Text size="small" className="text-ui-fg-subtle">Loading...</Text></div>
      ) : !services.length ? (
        <div className="px-6 py-10 text-center"><Text size="small" className="text-ui-fg-subtle">No services yet.</Text></div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Service</Table.HeaderCell>
              <Table.HeaderCell>Session</Table.HeaderCell>
              <Table.HeaderCell>People</Table.HeaderCell>
              <Table.HeaderCell />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {services.map((s) => (
              <Table.Row key={s.id}>
                <Table.Cell><Text size="small" weight="plus">{s.product?.title ?? s.product_id}</Text></Table.Cell>
                <Table.Cell>{s.duration_minutes ?? resource.session_duration_minutes} min{s.duration_minutes ? "" : " (default)"}</Table.Cell>
                <Table.Cell>{s.capacity ?? resource.capacity}{s.capacity ? "" : " (default)"}</Table.Cell>
                <Table.Cell className="text-right">
                  <IconButton size="small" variant="transparent" aria-label="Remove service" onClick={() => remove(s)}>
                    <Trash />
                  </IconButton>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}

      <FocusModal open={adding} onOpenChange={setAdding}>
        <FocusModal.Content>
          <FocusModal.Header><FocusModal.Title>Offer a service</FocusModal.Title></FocusModal.Header>
          <FocusModal.Body className="flex flex-col items-center overflow-y-auto py-8">
            <div className="flex w-full max-w-lg flex-col gap-y-5">
              <div className="flex flex-col gap-y-1">
                <Label size="small" weight="plus">Service (a product)</Label>
                <Select value={productId} onValueChange={setProductId} disabled={productsLoading}>
                  <Select.Trigger><Select.Value placeholder={productsLoading ? "Loading..." : "Choose a product"} /></Select.Trigger>
                  <Select.Content>
                    {available.map((p) => <Select.Item key={p.id} value={p.id}>{p.title}</Select.Item>)}
                  </Select.Content>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-y-1">
                  <Label size="small" weight="plus">Session length (min)</Label>
                  <Input type="number" min={1} value={duration} placeholder={String(resource.session_duration_minutes)} onChange={(e) => setDuration(e.target.value)} />
                </div>
                <div className="flex flex-col gap-y-1">
                  <Label size="small" weight="plus">People per slot</Label>
                  <Input type="number" min={1} value={capacity} placeholder={String(resource.capacity)} onChange={(e) => setCapacity(e.target.value)} />
                </div>
              </div>
              <Text size="small" className="text-ui-fg-error">{problem}</Text>
            </div>
          </FocusModal.Body>
          <FocusModal.Footer>
            <div className="flex gap-x-2">
              <Button variant="secondary" onClick={() => setAdding(false)}>Cancel</Button>
              <Button
                disabled={!!problem || save.isPending}
                isLoading={save.isPending}
                onClick={() =>
                  save.mutate([
                    ...toEntries(services),
                    { product_id: productId, duration_minutes: durationValue, capacity: capacityValue },
                  ])
                }
              >
                Add service
              </Button>
            </div>
          </FocusModal.Footer>
        </FocusModal.Content>
      </FocusModal>
    </Container>
  )
}

/* -------------------------------------------------------------- preview */

type PreviewView = "day" | "week" | "month"

const PREVIEW_VIEWS: { key: PreviewView; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
]

const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

/** Monday of the week containing the given "YYYY-MM-DD" key. */
const startOfWeekKey = (key: string) => {
  const dow = new Date(`${key}T00:00:00.000Z`).getUTCDay() // 0 = Sunday
  return addDaysToKey(key, -((dow + 6) % 7))
}

const startOfMonthKey = (key: string) => `${key.slice(0, 7)}-01`

const addMonthsToKey = (key: string, months: number) => {
  const d = new Date(`${startOfMonthKey(key)}T00:00:00.000Z`)
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.toISOString().slice(0, 10)
}

const keyLabel = (key: string, options: Intl.DateTimeFormatOptions) =>
  formatInZone(`${key}T12:00:00.000Z`, "UTC", options)

const hourLabel = (hour: number) =>
  formatInZone(`2000-01-01T${String(hour).padStart(2, "0")}:00:00.000Z`, "UTC", { hour: "numeric" })

/** Hour (0-23) and zero-padded minute of the instant in the given zone. */
const hourMinute = (iso: string, tz: string) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00"
  return { hour: Number(get("hour")), minute: get("minute") }
}

/** Day, Week or Month calendar of the slots customers can book right now. */
export const AppointmentPreviewSection = ({ resource }: { resource: Provider }) => {
  const tz = resource.timezone
  const today = localDateKey(new Date(), tz)
  const [view, setView] = useState<PreviewView>("week")
  const [anchor, setAnchor] = useState(today)

  // Days drawn for the current view (month = a full 6-week grid).
  const days = useMemo(() => {
    if (view === "day") return [anchor]
    if (view === "week") {
      const start = startOfWeekKey(anchor)
      return Array.from({ length: 7 }, (_, i) => addDaysToKey(start, i))
    }
    const start = startOfWeekKey(startOfMonthKey(anchor))
    return Array.from({ length: 42 }, (_, i) => addDaysToKey(start, i))
  }, [view, anchor])

  const firstDay = days[0]
  const lastDay = days[days.length - 1]

  // Padded by a day each side so every local day is fully covered whatever the
  // zone offset. A month grid (42 days + padding) is inside the 62-day limit.
  const from = useMemo(
    () => new Date(new Date(`${firstDay}T00:00:00.000Z`).getTime() - 26 * 3_600_000).toISOString(),
    [firstDay]
  )
  const to = useMemo(
    () => new Date(new Date(`${addDaysToKey(lastDay, 1)}T00:00:00.000Z`).getTime() + 26 * 3_600_000).toISOString(),
    [lastDay]
  )

  const { data, isLoading, isError, error } = useQuery<{ slots: PreviewSlot[] }>({
    queryKey: [["admin-provider-slots-preview", resource.id, from, to]],
    queryFn: () =>
      sdk.client.fetch(`/admin/providers/${resource.id}/slots-preview`, { query: { from, to } }),
  })

  const byDay = useMemo(() => {
    const map = new Map<string, PreviewSlot[]>()
    for (const s of data?.slots ?? []) {
      const k = localDateKey(s.start, tz)
      if (!days.includes(k)) continue
      map.set(k, [...(map.get(k) ?? []), s])
    }
    return map
  }, [data, days, tz])

  const step = (dir: 1 | -1) => {
    if (view === "day") setAnchor(addDaysToKey(anchor, dir))
    else if (view === "week") setAnchor(addDaysToKey(anchor, 7 * dir))
    else setAnchor(addMonthsToKey(anchor, dir))
  }

  const openDay = (day: string) => {
    setAnchor(day)
    setView("day")
  }

  const title =
    view === "day"
      ? keyLabel(anchor, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
      : view === "week"
        ? `${keyLabel(firstDay, { month: "short", day: "numeric" })} – ${keyLabel(lastDay, { month: "short", day: "numeric", year: "numeric" })}`
        : keyLabel(anchor, { month: "long", year: "numeric" })

  const slotColor = (s: PreviewSlot) => (s.spots_taken > 0 ? "blue" : "green")
  const slotRange = (s: PreviewSlot) => `${formatTime(s.start, tz)} – ${formatTime(s.end, tz)}`

  const renderDay = () => {
    const slots = byDay.get(anchor) ?? []
    if (!slots.length) {
      return <div className="px-6 py-8"><Text size="small" className="text-ui-fg-muted">No slots on this day.</Text></div>
    }
    return (
      <div className="flex flex-col divide-y">
        {slots.map((s) => (
          <div key={s.start} className="flex items-center gap-x-3 px-6 py-2">
            <Text size="small" weight="plus" className="w-44 whitespace-nowrap">{slotRange(s)}</Text>
            <Badge size="2xsmall" color={slotColor(s)}>
              {s.spots_taken > 0
                ? `${s.spots_taken}/${s.capacity} booked`
                : s.capacity > 1
                  ? `Open · ${s.capacity} spots`
                  : "Open"}
            </Badge>
          </div>
        ))}
      </div>
    )
  }

  const renderWeek = () => {
    const hours = new Set<number>()
    for (const list of byDay.values()) for (const s of list) hours.add(hourMinute(s.start, tz).hour)
    const sorted = [...hours].sort((a, b) => a - b)
    const rows = sorted.length
      ? Array.from({ length: sorted[sorted.length - 1] - sorted[0] + 1 }, (_, i) => sorted[0] + i)
      : []
    const gridCls = "grid min-w-[880px] grid-cols-[64px_repeat(7,minmax(0,1fr))] divide-x border-b"

    return (
      <div className="overflow-x-auto">
        <div className={gridCls}>
          <div />
          {days.map((day, i) => (
            <button
              key={day}
              type="button"
              onClick={() => openDay(day)}
              className="px-2 py-2 text-left hover:bg-ui-bg-base-hover"
            >
              <Text size="xsmall" className="text-ui-fg-subtle">{WEEKDAY_SHORT[i]}</Text>
              <Text size="small" weight="plus" className={day === today ? "text-ui-fg-interactive" : ""}>
                {keyLabel(day, { month: "short", day: "numeric" })}
              </Text>
            </button>
          ))}
        </div>
        {rows.length === 0 ? (
          <div className="px-6 py-8"><Text size="small" className="text-ui-fg-muted">No slots this week.</Text></div>
        ) : (
          rows.map((hour) => (
            <div key={hour} className={gridCls}>
              <div className="px-2 py-2 text-right">
                <Text size="xsmall" className="text-ui-fg-subtle">{hourLabel(hour)}</Text>
              </div>
              {days.map((day) => (
                <div key={day} className="flex min-h-[40px] flex-wrap content-start gap-1 p-1.5">
                  {(byDay.get(day) ?? [])
                    .filter((s) => hourMinute(s.start, tz).hour === hour)
                    .map((s) => (
                      <button
                        key={s.start}
                        type="button"
                        onClick={() => openDay(day)}
                        title={`${slotRange(s)} · ${s.capacity_remaining} of ${s.capacity} spots left`}
                      >
                        <Badge size="2xsmall" color={slotColor(s)}>
                          <span className="whitespace-nowrap">:{hourMinute(s.start, tz).minute}</span>
                        </Badge>
                      </button>
                    ))}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    )
  }

  const renderMonth = () => (
    <div className="overflow-x-auto">
      <div className="grid min-w-[700px] grid-cols-7 divide-x border-b">
        {WEEKDAY_SHORT.map((d) => (
          <div key={d} className="px-2 py-2"><Text size="xsmall" className="text-ui-fg-subtle">{d}</Text></div>
        ))}
      </div>
      <div className="grid min-w-[700px] grid-cols-7">
        {days.map((day) => {
          const list = byDay.get(day) ?? []
          const open = list.filter((s) => s.spots_taken === 0).length
          const booked = list.length - open
          const inMonth = day.slice(0, 7) === anchor.slice(0, 7)
          return (
            <button
              key={day}
              type="button"
              onClick={() => openDay(day)}
              className={`flex min-h-[92px] flex-col items-start gap-y-1 border-b border-r p-2 text-left hover:bg-ui-bg-base-hover ${
                inMonth ? "" : "bg-ui-bg-subtle"
              }`}
            >
              <Text
                size="small"
                weight="plus"
                className={day === today ? "text-ui-fg-interactive" : inMonth ? "" : "text-ui-fg-muted"}
              >
                {Number(day.slice(8))}
              </Text>
              {open > 0 ? <Badge size="2xsmall" color="green"><span className="whitespace-nowrap">{open} open</span></Badge> : null}
              {booked > 0 ? <Badge size="2xsmall" color="blue"><span className="whitespace-nowrap">{booked} booked</span></Badge> : null}
              {list.length === 0 && inMonth ? <Text size="xsmall" className="text-ui-fg-muted">No slots</Text> : null}
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">Preview</Heading>
        <Text size="small" className="text-ui-fg-subtle">What customers see right now ({tz}).</Text>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
        <div className="flex items-center gap-x-2">
          <Button size="small" variant="secondary" onClick={() => setAnchor(today)}>Today</Button>
          <Button size="small" variant="secondary" onClick={() => step(-1)}>Previous</Button>
          <Button size="small" variant="secondary" onClick={() => step(1)}>Next</Button>
          <Input
            type="date"
            className="w-40"
            value={anchor}
            onChange={(e) => e.target.value && setAnchor(e.target.value)}
          />
        </div>
        <Text size="base" weight="plus">{title}</Text>
        <div className="flex items-center gap-x-1">
          {PREVIEW_VIEWS.map((v) => (
            <Button
              key={v.key}
              size="small"
              variant={view === v.key ? "primary" : "secondary"}
              onClick={() => setView(v.key)}
            >
              {v.label}
            </Button>
          ))}
        </div>
      </div>
      {isLoading ? (
        <div className="px-6 py-8"><Text size="small" className="text-ui-fg-subtle">Loading...</Text></div>
      ) : isError ? (
        <div className="px-6 py-8"><Text size="small" className="text-ui-fg-error">{(error as Error)?.message}</Text></div>
      ) : view === "day" ? (
        renderDay()
      ) : view === "week" ? (
        renderWeek()
      ) : (
        renderMonth()
      )}
    </Container>
  )
}

/* ------------------------------------------------------------- bookings */

const PAGE_SIZE = 20

export const AppointmentBookingsSection = ({ resource }: { resource: Provider }) => {
  const queryClient = useQueryClient()
  const [when, setWhen] = useState<"upcoming" | "past">("upcoming")
  const [offset, setOffset] = useState(0)
  const [target, setTarget] = useState<{ booking: Booking; attendee: BookingAttendee } | null>(null)
  const [rescheduleTarget, setRescheduleTarget] = useState<{ booking: Booking; attendee: BookingAttendee } | null>(null)
  const [reason, setReason] = useState("")
  const [notify, setNotify] = useState(true)
  const cancelHasEmail = !!target?.attendee.buyer_email

  const key = [["admin-provider-appointments", resource.id, when, offset]]

  const { data, isLoading, isError, error } = useQuery<BookingListResponse>({
    queryKey: key,
    queryFn: () =>
      sdk.client.fetch(`/admin/providers/${resource.id}/appointments`, {
        query: { status: when, limit: PAGE_SIZE, offset },
      }),
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: [["admin-provider-appointments", resource.id]] })

  const cancel = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/appointments/${target!.attendee.id}/cancel`, {
        method: "POST",
        body: { reason: reason.trim(), notify: notify && cancelHasEmail },
      }),
    onSuccess: () => {
      toast.success("Booking cancelled")
      setTarget(null)
      setReason("")
      setNotify(true)
      refresh()
    },
    onError: (e: any) => toast.error(e?.message || "Could not cancel the booking"),
  })

  const complete = useMutation({
    mutationFn: (id: string) => sdk.client.fetch(`/admin/appointments/${id}/complete`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Marked as completed")
      refresh()
    },
    onError: (e: any) => toast.error(e?.message || "Could not mark as completed"),
  })

  const bookings = data?.appointments ?? []
  const count = data?.count ?? 0

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-wrap items-end justify-between gap-4 px-6 py-4">
        <div>
          <Heading level="h2">Bookings</Heading>
          <Text size="small" className="text-ui-fg-subtle">Confirmed appointments for this resource.</Text>
        </div>
        <Select value={when} onValueChange={(v) => { setWhen(v as "upcoming" | "past"); setOffset(0) }}>
          <Select.Trigger className="w-36"><Select.Value /></Select.Trigger>
          <Select.Content>
            <Select.Item value="upcoming">Upcoming</Select.Item>
            <Select.Item value="past">Past</Select.Item>
          </Select.Content>
        </Select>
      </div>

      {isLoading ? (
        <div className="px-6 py-8"><Text size="small" className="text-ui-fg-subtle">Loading...</Text></div>
      ) : isError ? (
        <div className="px-6 py-8"><Text size="small" className="text-ui-fg-error">{(error as Error)?.message}</Text></div>
      ) : !bookings.length ? (
        <div className="px-6 py-10 text-center"><Text size="small" className="text-ui-fg-subtle">No {when} bookings.</Text></div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>When</Table.HeaderCell>
              <Table.HeaderCell>Service</Table.HeaderCell>
              <Table.HeaderCell>Customer</Table.HeaderCell>
              <Table.HeaderCell>Booked</Table.HeaderCell>
              <Table.HeaderCell />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {bookings.map((b) => {
              const confirmed = b.attendees.filter((a) => a.status === "confirmed")
              const started = new Date(b.start_time).getTime() <= Date.now()
              return (
                <Table.Row key={b.id} className="align-top">
                  <Table.Cell>
                    <Text size="small" weight="plus">{formatSlotDateTime(b.start_time, b.resource.timezone)}</Text>
                    <Text size="xsmall" className="text-ui-fg-subtle">until {formatTime(b.end_time, b.resource.timezone)}</Text>
                  </Table.Cell>
                  <Table.Cell>{b.service.title ?? "-"}</Table.Cell>
                  <Table.Cell>
                    <div className="flex flex-col gap-y-2">
                      {b.attendees.map((a) => (
                        <div key={a.id} className="flex flex-col">
                          <div className="flex items-center gap-x-2">
                            <Text size="small" weight="plus">{a.buyer_name || "Guest"}</Text>
                            {a.status === "cancelled" ? <Badge size="2xsmall" color="red">Cancelled</Badge> : null}
                            {a.status === "reserved" ? <Badge size="2xsmall" color="orange">Awaiting payment</Badge> : null}
                            {a.status === "confirmed" && a.rescheduled_from_start ? <Badge size="2xsmall" color="blue">Rescheduled</Badge> : null}
                          </div>
                          <Text size="xsmall" className="text-ui-fg-subtle">{[a.buyer_email, a.buyer_phone].filter(Boolean).join(" · ")}</Text>
                          {a.status === "cancelled" && a.cancel_reason ? (
                            <Text size="xsmall" className="text-ui-fg-muted">{a.cancelled_by}: {a.cancel_reason}</Text>
                          ) : null}
                          {a.status === "confirmed" && a.rescheduled_from_start ? (
                            <Text size="xsmall" className="text-ui-fg-muted">
                              Moved from {formatSlotDateTime(a.rescheduled_from_start, b.resource.timezone)}
                              {a.rescheduled_by === "buyer" ? " by the customer" : ""}
                            </Text>
                          ) : null}
                          {a.status === "confirmed" && !started && b.status !== "completed" ? (
                            <div className="mt-1 flex gap-x-3">
                              <button type="button" className="text-ui-fg-interactive txt-compact-xsmall w-fit" onClick={() => setRescheduleTarget({ booking: b, attendee: a })}>
                                Reschedule
                              </button>
                              <button type="button" className="text-ui-fg-error txt-compact-xsmall w-fit" onClick={() => setTarget({ booking: b, attendee: a })}>
                                Cancel
                              </button>
                            </div>
                          ) : a.status === "confirmed" ? (
                            <button type="button" className="text-ui-fg-error txt-compact-xsmall w-fit" onClick={() => setTarget({ booking: b, attendee: a })}>
                              Cancel
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </Table.Cell>
                  <Table.Cell>{confirmed.length} / {b.max_capacity}</Table.Cell>
                  <Table.Cell className="text-right">
                    {b.status === "completed" ? (
                      <Badge size="2xsmall" color="green">Completed</Badge>
                    ) : started && confirmed.length ? (
                      <Button size="small" variant="secondary" disabled={complete.isPending} onClick={() => complete.mutate(b.id)}>
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
          <Text size="small" className="text-ui-fg-subtle">{offset + 1}-{Math.min(offset + PAGE_SIZE, count)} of {count}</Text>
          <div className="flex gap-x-2">
            <Button size="small" variant="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>Previous</Button>
            <Button size="small" variant="secondary" disabled={offset + PAGE_SIZE >= count} onClick={() => setOffset(offset + PAGE_SIZE)}>Next</Button>
          </div>
        </div>
      ) : null}

      <FocusModal open={!!target} onOpenChange={(open) => !open && setTarget(null)}>
        <FocusModal.Content>
          <FocusModal.Header><FocusModal.Title>Cancel booking</FocusModal.Title></FocusModal.Header>
          <FocusModal.Body className="flex flex-col items-center py-8">
            {target ? (
              <div className="flex w-full max-w-lg flex-col gap-y-4">
                <Text size="small">
                  Cancel {target.attendee.buyer_name || "this customer"}&rsquo;s booking on{" "}
                  <strong>{formatSlotDateTime(target.booking.start_time, target.booking.resource.timezone)}</strong>?
                </Text>
                <div className="flex flex-col gap-y-1">
                  <Label size="small" weight="plus">Reason</Label>
                  <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
                </div>
                <div className="flex items-start gap-x-2">
                  <Checkbox
                    id="admin-cancel-notify"
                    checked={notify && cancelHasEmail}
                    disabled={!cancelHasEmail}
                    onCheckedChange={(v) => setNotify(v === true)}
                  />
                  <div className="flex flex-col">
                    <Label htmlFor="admin-cancel-notify" size="small" weight="plus">
                      Email {target.attendee.buyer_name || "the customer"} that this booking is cancelled
                    </Label>
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      {cancelHasEmail ? "The reason above is included in the email." : "No email on file for this customer."}
                    </Text>
                  </div>
                </div>
                {target.attendee.order_id ? (
                  <div className="bg-ui-bg-subtle rounded-md p-3">
                    <Text size="small">
                      <strong>Paid online (order {target.attendee.order_id}).</strong> Cancelling does <strong>not</strong> refund
                      it. Refund the order from Orders if you need to.
                    </Text>
                  </div>
                ) : null}
                <div className="bg-ui-bg-subtle rounded-md p-3">
                  <Text size="small" className="text-ui-fg-subtle">
                    The place is released straight away and can be booked again.
                  </Text>
                </div>
              </div>
            ) : null}
          </FocusModal.Body>
          <FocusModal.Footer>
            <div className="flex gap-x-2">
              <Button variant="secondary" onClick={() => setTarget(null)}>Keep booking</Button>
              <Button variant="danger" disabled={!reason.trim() || cancel.isPending} isLoading={cancel.isPending} onClick={() => cancel.mutate()}>
                Cancel booking
              </Button>
            </div>
          </FocusModal.Footer>
        </FocusModal.Content>
      </FocusModal>

      <AdminRescheduleModal
        target={rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        onDone={refresh}
      />
    </Container>
  )
}

/**
 * Moves one customer's booking to another time on the same resource and service.
 * Same behaviour as the seller panel's dialog: the times offered are the ones a
 * buyer could book except that the minimum-notice rule is waived and the
 * booking's own neighbouring times are available. Payment does not change.
 */
const AdminRescheduleModal = ({
  target,
  onClose,
  onDone,
}: {
  target: { booking: Booking; attendee: BookingAttendee } | null
  onClose: () => void
  onDone: () => void
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
  const slots = useQuery<{ slots: RescheduleSlot[] }>({
    queryKey: [["admin-reschedule-slots", attendeeId, date]],
    queryFn: () =>
      sdk.client.fetch(`/admin/appointments/${attendeeId}/reschedule-slots`, {
        query: {
          from: new Date(`${addDaysToKey(date, -1)}T00:00:00Z`).toISOString(),
          to: new Date(`${addDaysToKey(date, 2)}T00:00:00Z`).toISOString(),
        },
      }),
    enabled: !!attendeeId && !!date,
  })
  const daySlots = (slots.data?.slots ?? []).filter(
    (s) => localDateKey(s.start, timezone) === date && s.capacity_remaining > 0
  )

  useEffect(() => setStart(""), [date])

  const move = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/appointments/${attendeeId}/reschedule`, {
        method: "POST",
        body: { start, notify: notify && hasEmail },
      }),
    onSuccess: () => {
      toast.success("Booking rescheduled")
      onDone()
      onClose()
    },
    onError: (e: any) => {
      toast.error(e?.message || "Could not reschedule the booking")
      // The time may have just been taken; refresh what is on offer.
      queryClient.invalidateQueries({ queryKey: [["admin-reschedule-slots"]] })
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
                <Text size="small" weight="plus">{target.attendee.buyer_name || "Guest"}</Text>
                <Text size="small" className="text-ui-fg-subtle">
                  {target.booking.service.title ?? "Appointment"} · {target.booking.resource.display_name ?? "Resource"}
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
                    min={localDateKey(new Date(), timezone)}
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
                  id="admin-reschedule-notify"
                  checked={notify && hasEmail}
                  disabled={!hasEmail}
                  onCheckedChange={(v) => setNotify(v === true)}
                />
                <div className="flex flex-col">
                  <Label htmlFor="admin-reschedule-notify" size="small" weight="plus">
                    Email {target.attendee.buyer_name || "the customer"} about the new time
                  </Label>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {hasEmail ? "Includes a link to change or cancel it again." : "No email on file for this customer."}
                  </Text>
                </div>
              </div>

              <div className="bg-ui-bg-subtle rounded-md p-3">
                <Text size="small" className="text-ui-fg-subtle">
                  You are not limited by the customer&rsquo;s change window. Times offered follow the resource&rsquo;s hours,
                  holidays and capacity. Payment does not change.
                </Text>
              </div>
            </>
          ) : null}
        </FocusModal.Body>
        <FocusModal.Footer>
          <Button variant="secondary" onClick={onClose}>Keep booking</Button>
          <Button disabled={!start || move.isPending} isLoading={move.isPending} onClick={() => move.mutate()}>
            Reschedule
          </Button>
        </FocusModal.Footer>
      </FocusModal.Content>
    </FocusModal>
  )
}
