"use client"

import {
  createVendorResourceException,
  deleteVendorResourceException,
  getVendorSlotsPreview,
  listVendorResourceExceptions,
  listVendorResourceServices,
  type VendorPreviewSlot,
  type VendorResource,
} from "@lib/data/vendor-client"
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Label,
  Select,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import {
  addDaysToKey,
  formatCalendarDate,
  formatInZone,
  formatTime,
  localDateKey,
  localHHmm,
  todayKey,
} from "../lib/format"

type View = "day" | "week" | "month"

const VIEWS: { key: View; label: string }[] = [
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
  formatInZone(`2000-01-01T${String(hour).padStart(2, "0")}:00:00.000Z`, "UTC", {
    hour: "numeric",
  })

const hourOf = (iso: string, tz: string) => Number(localHHmm(iso, tz).slice(0, 2))

/**
 * "This is what customers see." Slots are computed live on the server from the
 * resource's hours, holidays, session length, buffers and rules, so this is the
 * quickest way to check a setup. Shown as a Day, Week or Month calendar. In the
 * Day view a single slot can be closed with "Block", which is just a one-slot
 * time-off entry (and "Unblock" removes it).
 */
export const PreviewTab = ({
  resource,
  productId: lockedProductId,
}: {
  resource: Pick<VendorResource, "id" | "timezone">
  /** When set, the calendar shows only this product and the service picker is hidden. */
  productId?: string
}) => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const tz = resource.timezone

  const [productId, setProductId] = useState(lockedProductId ?? "")
  const [view, setView] = useState<View>("week")
  const [anchor, setAnchor] = useState(todayKey(tz))

  const services = useQuery({
    queryKey: ["vendor-resource-services", resource.id],
    queryFn: () => listVendorResourceServices(resource.id),
    enabled: !lockedProductId,
  })

  // The days drawn for the current view (month = a full 6-week grid).
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

  // Padded by a day each side so every local day in the window is fully covered
  // whatever the zone offset; slots outside the shown days are filtered below.
  // (A month grid is 42 days + padding, inside the server's 62-day limit.)
  const from = useMemo(
    () => new Date(new Date(`${firstDay}T00:00:00.000Z`).getTime() - 26 * 3_600_000).toISOString(),
    [firstDay]
  )
  const to = useMemo(
    () =>
      new Date(
        new Date(`${addDaysToKey(lastDay, 1)}T00:00:00.000Z`).getTime() + 26 * 3_600_000
      ).toISOString(),
    [lastDay]
  )

  const slotsQuery = useQuery({
    queryKey: ["vendor-slots-preview", resource.id, productId, from, to],
    queryFn: () =>
      getVendorSlotsPreview(resource.id, { product_id: productId || undefined, from, to }),
  })

  const exceptions = useQuery({
    queryKey: ["vendor-resource-exceptions", resource.id],
    queryFn: () => listVendorResourceExceptions(resource.id),
  })

  const byDay = useMemo(() => {
    const map = new Map<string, VendorPreviewSlot[]>()
    for (const slot of slotsQuery.data?.slots ?? []) {
      const key = localDateKey(slot.start, tz)
      if (!days.includes(key)) continue
      const list = map.get(key) ?? []
      list.push(slot)
      map.set(key, list)
    }
    return map
  }, [slotsQuery.data, days, tz])

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["vendor-slots-preview", resource.id] })
    queryClient.invalidateQueries({ queryKey: ["vendor-resource-exceptions", resource.id] })
  }

  const block = useMutation({
    mutationFn: (slot: VendorPreviewSlot) =>
      createVendorResourceException(resource.id, {
        date: localDateKey(slot.start, tz),
        type: "blackout",
        start_time: localHHmm(slot.start, tz),
        end_time: localHHmm(slot.end, tz),
        reason: "Blocked slot",
      }),
    onSuccess: () => {
      toast.success("Slot blocked")
      refresh()
    },
    onError: (e: any) => toast.error(e?.message || "Could not block this slot"),
  })

  const unblock = useMutation({
    mutationFn: (id: string) => deleteVendorResourceException(resource.id, id),
    onSuccess: () => {
      toast.success("Unblocked")
      refresh()
    },
    onError: (e: any) => toast.error(e?.message || "Could not unblock"),
  })

  const confirmBlock = async (slot: VendorPreviewSlot) => {
    const ok = await prompt({
      title: "Block this slot?",
      description: `${formatInZone(slot.start, tz, { weekday: "long", month: "short", day: "numeric" })} at ${formatTime(slot.start, tz)} will no longer be offered to customers.`,
      confirmText: "Block",
      cancelText: "Cancel",
    })
    if (ok) block.mutate(slot)
  }

  const blockedInRange = (exceptions.data?.availability_exceptions ?? []).filter(
    (e) =>
      e.type === "blackout" &&
      e.start_time &&
      e.end_time &&
      days.includes(e.date.slice(0, 10))
  )

  const serviceList = services.data?.services ?? []
  const today = todayKey(tz)

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

  const slotColor = (slot: VendorPreviewSlot) => (slot.spots_taken > 0 ? "blue" : "green")
  const slotRange = (slot: VendorPreviewSlot) =>
    `${formatTime(slot.start, tz)} – ${formatTime(slot.end, tz)}`

  /* ---------------------------------------------------------------- views */

  const renderDay = () => {
    const slots = byDay.get(anchor) ?? []
    if (!slots.length) {
      return (
        <div className="px-6 py-8">
          <Text size="small" className="text-ui-fg-muted">No slots on this day.</Text>
        </div>
      )
    }
    return (
      <div className="flex flex-col divide-y">
        {slots.map((slot) => (
          <div key={slot.start} className="flex items-center justify-between gap-x-4 px-6 py-2">
            <div className="flex items-center gap-x-3">
              <Text size="small" weight="plus" className="w-44 whitespace-nowrap">
                {slotRange(slot)}
              </Text>
              <Badge size="2xsmall" color={slotColor(slot)}>
                {slot.spots_taken > 0
                  ? `${slot.spots_taken}/${slot.capacity} booked`
                  : slot.capacity > 1
                    ? `Open · ${slot.capacity} spots`
                    : "Open"}
              </Badge>
            </div>
            {/* A slot that ends exactly at midnight cannot be expressed as a
                same-day block (its end reads 00:00), so it has no Block action. */}
            {slot.spots_taken === 0 && localHHmm(slot.end, tz) > localHHmm(slot.start, tz) ? (
              <button
                type="button"
                className="text-ui-fg-muted hover:text-ui-fg-base txt-compact-small"
                disabled={block.isPending}
                onClick={() => confirmBlock(slot)}
              >
                Block
              </button>
            ) : null}
          </div>
        ))}
      </div>
    )
  }

  const renderWeek = () => {
    // Hour rows cover only the hours that actually have slots this week.
    const hours = new Set<number>()
    for (const list of byDay.values()) {
      for (const slot of list) hours.add(hourOf(slot.start, tz))
    }
    const sorted = [...hours].sort((a, b) => a - b)
    const rows = sorted.length
      ? Array.from({ length: sorted[sorted.length - 1] - sorted[0] + 1 }, (_, i) => sorted[0] + i)
      : []

    return (
      <div className="overflow-x-auto">
        <div className="grid min-w-[880px] grid-cols-[64px_repeat(7,minmax(0,1fr))] divide-x border-b">
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
          <div className="px-6 py-8">
            <Text size="small" className="text-ui-fg-muted">No slots this week.</Text>
          </div>
        ) : (
          rows.map((hour) => (
            <div
              key={hour}
              className="grid min-w-[880px] grid-cols-[64px_repeat(7,minmax(0,1fr))] divide-x border-b"
            >
              <div className="px-2 py-2 text-right">
                <Text size="xsmall" className="text-ui-fg-subtle">{hourLabel(hour)}</Text>
              </div>
              {days.map((day) => {
                const inHour = (byDay.get(day) ?? []).filter((s) => hourOf(s.start, tz) === hour)
                return (
                  <div key={day} className="flex min-h-[40px] flex-wrap content-start gap-1 p-1.5">
                    {inHour.map((slot) => (
                      <button
                        key={slot.start}
                        type="button"
                        onClick={() => openDay(day)}
                        title={`${slotRange(slot)} · ${slot.capacity_remaining} of ${slot.capacity} spots left`}
                      >
                        <Badge size="2xsmall" color={slotColor(slot)}>
                          <span className="whitespace-nowrap">:{localHHmm(slot.start, tz).slice(3)}</span>
                        </Badge>
                      </button>
                    ))}
                  </div>
                )
              })}
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
          <div key={d} className="px-2 py-2">
            <Text size="xsmall" className="text-ui-fg-subtle">{d}</Text>
          </div>
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
              {open > 0 ? (
                <Badge size="2xsmall" color="green">
                  <span className="whitespace-nowrap">{open} open</span>
                </Badge>
              ) : null}
              {booked > 0 ? (
                <Badge size="2xsmall" color="blue">
                  <span className="whitespace-nowrap">{booked} booked</span>
                </Badge>
              ) : null}
              {list.length === 0 && inMonth ? (
                <Text size="xsmall" className="text-ui-fg-muted">No slots</Text>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-wrap items-end justify-between gap-4 px-6 py-4">
        <div>
          <Heading level="h2">Preview</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            What customers see right now ({tz}). Times held by an unpaid checkout are
            already excluded.
          </Text>
        </div>
        {lockedProductId ? null : (
        <div className="flex flex-col gap-y-1">
          <Label size="small" weight="plus">Service</Label>
          <Select value={productId || "any"} onValueChange={(v) => setProductId(v === "any" ? "" : v)}>
            <Select.Trigger className="w-48">
              <Select.Value placeholder="Any" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="any">Resource defaults</Select.Item>
              {serviceList.map((s) => (
                <Select.Item key={s.product_id} value={s.product_id}>
                  {s.product?.title ?? s.product_id}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
        )}
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
          {VIEWS.map((v) => (
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

      {slotsQuery.isLoading ? (
        <div className="px-6 py-8"><Text size="small" className="text-ui-fg-subtle">Loading...</Text></div>
      ) : slotsQuery.isError ? (
        <div className="px-6 py-8">
          <Text size="small" className="text-ui-fg-error">{(slotsQuery.error as Error)?.message}</Text>
        </div>
      ) : view === "day" ? (
        renderDay()
      ) : view === "week" ? (
        renderWeek()
      ) : (
        renderMonth()
      )}

      {blockedInRange.length ? (
        <div className="flex flex-col gap-y-2 px-6 py-4">
          <Text size="small" weight="plus">Blocked in this view</Text>
          {blockedInRange.map((e) => (
            <div key={e.id} className="flex items-center gap-x-3">
              <Badge size="2xsmall" color="orange">
                {formatCalendarDate(e.date)} {e.start_time}–{e.end_time}
              </Badge>
              <Text size="xsmall" className="text-ui-fg-subtle">{e.reason ?? ""}</Text>
              <button
                type="button"
                className="text-ui-fg-interactive txt-compact-xsmall"
                disabled={unblock.isPending}
                onClick={() => unblock.mutate(e.id)}
              >
                Unblock
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </Container>
  )
}
