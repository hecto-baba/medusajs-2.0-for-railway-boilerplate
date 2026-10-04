"use client"

import {
  getVendorProductAppointmentConfig,
  setVendorProductAppointmentConfig,
  type VendorProduct,
  type VendorProductAppointmentResource,
} from "@lib/data/vendor-client"
import {
  Badge,
  Button,
  Drawer,
  FocusModal,
  Input,
  Label,
  Text,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useState } from "react"
import { PreviewTab } from "@modules/appointments/components/preview-tab"
import { Section } from "./section"

type Draft = { on: boolean; duration: string; capacity: string }

const nameOf = (r: VendorProductAppointmentResource) => r.display_name || "Unnamed resource"

/** "" -> null (use the resource's default); otherwise a whole number >= 1. */
const toNumber = (value: string): number | null | "invalid" => {
  const trimmed = value.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  return Number.isInteger(n) && n >= 1 ? n : "invalid"
}

/**
 * Makes this product bookable. A product becomes an appointment when one or more
 * of the seller's resources (a stylist, a room, ...) offer it; each one keeps its
 * own weekly hours, holidays and booking rules. The price still comes from the
 * product's variant. This reads and writes the same offerings as a resource's
 * Services tab, so the two screens always agree.
 */
export const AppointmentSection = ({ product }: { product: VendorProduct }) => {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [calendarFor, setCalendarFor] = useState<VendorProductAppointmentResource | null>(null)

  const queryKey = ["vendor-product-appointment-config", product.id]
  const { data, isLoading, isError, error } = useQuery({
    queryKey,
    queryFn: () => getVendorProductAppointmentConfig(product.id),
  })

  const resources = data?.resources ?? []
  const offered = resources.filter((r) => r.offered)

  const openPanel = () => {
    setDrafts(
      Object.fromEntries(
        resources.map((r) => [
          r.id,
          {
            on: r.offered,
            duration: r.duration_minutes != null ? String(r.duration_minutes) : "",
            capacity: r.capacity != null ? String(r.capacity) : "",
          },
        ])
      )
    )
    setFormError(null)
    setOpen(true)
  }

  const setDraft = (id: string, patch: Partial<Draft>) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))

  const { mutateAsync: save, isPending } = useMutation({
    mutationFn: (
      entries: { resource_id: string; duration_minutes: number | null; capacity: number | null }[]
    ) => setVendorProductAppointmentConfig(product.id, entries),
    onSuccess: (fresh) => {
      queryClient.setQueryData(queryKey, fresh)
      // The resource pages list the same offerings.
      queryClient.invalidateQueries({ queryKey: ["vendor-resource-services"] })
      queryClient.invalidateQueries({ queryKey: ["vendor-resources"] })
    },
  })

  const onSave = async () => {
    setFormError(null)
    const entries: { resource_id: string; duration_minutes: number | null; capacity: number | null }[] = []

    for (const r of resources) {
      const d = drafts[r.id]
      if (!d?.on) continue
      const duration = toNumber(d.duration)
      const capacity = toNumber(d.capacity)
      if (duration === "invalid" || capacity === "invalid") {
        setFormError(`${nameOf(r)}: session length and people per slot must be whole numbers of 1 or more.`)
        return
      }
      entries.push({ resource_id: r.id, duration_minutes: duration, capacity })
    }

    try {
      await save(entries)
      toast.success(entries.length ? "Appointment settings saved." : "No longer an appointment.")
      setOpen(false)
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not save.")
    }
  }

  const heading = "Booking"

  if (isLoading) {
    return (
      <Section title={heading}>
        <div className="px-6 py-4">
          <Text size="small" className="text-ui-fg-muted">Loading…</Text>
        </div>
      </Section>
    )
  }

  if (isError) {
    return (
      <Section title={heading}>
        <div className="px-6 py-4">
          <Text size="small" className="text-ui-fg-error">
            {error instanceof Error ? error.message : "Could not load appointment settings."}
          </Text>
        </div>
      </Section>
    )
  }

  return (
    <Section
      title={heading}
      actions={
        offered.length ? (
          <Button size="small" variant="secondary" onClick={openPanel}>
            Edit
          </Button>
        ) : null
      }
    >
      {offered.length ? (
        <>
          <div className="px-6 py-3">
            <Text size="small" className="text-ui-fg-subtle">
              Customers can book &ldquo;{product.title}&rdquo; with {offered.length}{" "}
              {offered.length === 1 ? "resource" : "resources"}. The price comes from the
              product&rsquo;s variants.
            </Text>
          </div>
          {offered.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
              <div className="flex flex-col gap-y-0.5">
                <div className="flex items-center gap-x-2">
                  <Text size="small" weight="plus">{nameOf(r)}</Text>
                  {r.live ? (
                    <Badge size="2xsmall" color="green">Active</Badge>
                  ) : (
                    <Badge size="2xsmall" color="orange">Needs setup</Badge>
                  )}
                </div>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {r.duration_minutes ?? r.default_duration_minutes} min per session ·{" "}
                  {r.capacity ?? r.default_capacity}{" "}
                  {(r.capacity ?? r.default_capacity) === 1 ? "person" : "people"} per slot
                </Text>
                {!r.live && r.missing.length ? (
                  <Text size="xsmall" className="text-ui-fg-error">
                    {r.missing.join(" · ")}
                  </Text>
                ) : null}
              </div>
              <div className="flex items-center gap-x-2">
                <Button size="small" variant="secondary" onClick={() => setCalendarFor(r)}>
                  View calendar
                </Button>
                <Link href={`/appointments/resources/${r.id}`}>
                  <Button size="small" variant="secondary">Manage {nameOf(r)}</Button>
                </Link>
              </div>
            </div>
          ))}
        </>
      ) : (
        <div className="flex items-center justify-between gap-4 px-6 py-4">
          <Text size="small" className="text-ui-fg-muted">
            Not bookable yet. Customers can&rsquo;t book &ldquo;{product.title}&rdquo; until one of
            your resources offers it.
          </Text>
          <Button size="small" variant="secondary" onClick={openPanel}>
            Make it an appointment
          </Button>
        </div>
      )}

      <FocusModal open={Boolean(calendarFor)} onOpenChange={(o) => !o && setCalendarFor(null)}>
        <FocusModal.Content>
          <FocusModal.Header>
            <FocusModal.Title>
              {calendarFor ? `${nameOf(calendarFor)} · ${product.title}` : ""}
            </FocusModal.Title>
          </FocusModal.Header>
          <FocusModal.Body className="overflow-y-auto p-6">
            {calendarFor ? (
              <PreviewTab
                resource={{ id: calendarFor.id, timezone: calendarFor.timezone }}
                productId={product.id}
              />
            ) : null}
          </FocusModal.Body>
        </FocusModal.Content>
      </FocusModal>

      <Drawer open={open} onOpenChange={setOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>
              {offered.length ? "Edit appointment" : `Make “${product.title}” an appointment`}
            </Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-y-4 overflow-y-auto">
            {resources.length ? (
              <>
                <Text size="small" className="text-ui-fg-subtle">
                  Choose who offers this. Pick one or several. Leave a field empty to use that
                  resource&rsquo;s own default.
                </Text>
                {resources.map((r) => {
                  const d = drafts[r.id]
                  if (!d) return null
                  return (
                    <div
                      key={r.id}
                      className={
                        "flex flex-col gap-y-3 rounded-lg border p-3 " +
                        (d.on ? "border-ui-border-interactive" : "border-ui-border-base")
                      }
                    >
                      <label className="flex cursor-pointer items-center gap-x-2">
                        <input
                          type="checkbox"
                          checked={d.on}
                          onChange={(e) => setDraft(r.id, { on: e.target.checked })}
                        />
                        <Text size="small" weight="plus">{nameOf(r)}</Text>
                        {r.status !== "active" ? (
                          <Badge size="2xsmall" color="grey">Inactive</Badge>
                        ) : null}
                        {r.missing.includes("Add weekly hours") ? (
                          <Badge size="2xsmall" color="orange">Needs weekly hours</Badge>
                        ) : null}
                      </label>
                      {d.on ? (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex flex-col gap-y-1">
                            <Label size="small" weight="plus" htmlFor={`appt-dur-${r.id}`}>
                              Session length (min)
                            </Label>
                            <Input
                              id={`appt-dur-${r.id}`}
                              type="number"
                              min={1}
                              placeholder={String(r.default_duration_minutes)}
                              value={d.duration}
                              onChange={(e) => setDraft(r.id, { duration: e.target.value })}
                            />
                          </div>
                          <div className="flex flex-col gap-y-1">
                            <Label size="small" weight="plus" htmlFor={`appt-cap-${r.id}`}>
                              People per slot
                            </Label>
                            <Input
                              id={`appt-cap-${r.id}`}
                              type="number"
                              min={1}
                              placeholder={String(r.default_capacity)}
                              value={d.capacity}
                              onChange={(e) => setDraft(r.id, { capacity: e.target.value })}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
                <Text size="xsmall" className="text-ui-fg-muted">
                  Weekly hours, holidays and buffers are set on each resource&rsquo;s own page.
                  Removing a resource does not cancel bookings that already exist.
                </Text>
              </>
            ) : (
              <div className="flex flex-col items-center gap-y-3 rounded-lg border border-dashed px-4 py-8 text-center">
                <Text size="small" weight="plus">You have no resources yet</Text>
                <Text size="small" className="text-ui-fg-subtle">
                  A resource is a person or room that gets booked, like a stylist or a treatment room.
                </Text>
                <Link href="/appointments/resources">
                  <Button size="small">Create a resource</Button>
                </Link>
              </div>
            )}
            {formError ? (
              <Text size="small" className="text-ui-fg-error">{formError}</Text>
            ) : null}
          </Drawer.Body>
          <Drawer.Footer>
            <Button size="small" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="small"
              onClick={onSave}
              isLoading={isPending}
              disabled={isPending || !resources.length}
            >
              Save
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </Section>
  )
}
