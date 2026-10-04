"use client"

import {
  createVendorResource,
  updateVendorResource,
  type VendorResource,
} from "@lib/data/vendor-client"
import { Button, Drawer, Input, Label, Text, Textarea, toast } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { browserTimeZone, getTimeZones, isKnownTimeZone } from "../lib/format"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Present = edit; absent = create. */
  resource?: VendorResource | null
  onSaved?: (resource: VendorResource) => void
}

type FormState = {
  display_name: string
  kind: string
  description: string
  image_url: string
  timezone: string
  session_duration_minutes: string
  slot_step_minutes: string
  capacity: string
  buffer_before_minutes: string
  buffer_after_minutes: string
  min_notice_minutes: string
  max_advance_days: string
  hold_minutes: string
  cancellation_window_hours: string
}

const DEFAULTS: FormState = {
  display_name: "",
  kind: "staff",
  description: "",
  image_url: "",
  timezone: browserTimeZone(),
  session_duration_minutes: "30",
  slot_step_minutes: "",
  capacity: "1",
  buffer_before_minutes: "0",
  buffer_after_minutes: "0",
  min_notice_minutes: "60",
  max_advance_days: "60",
  hold_minutes: "10",
  cancellation_window_hours: "24",
}

const fromResource = (r: VendorResource): FormState => ({
  display_name: r.display_name ?? "",
  kind: r.kind ?? "staff",
  description: r.description ?? "",
  image_url: r.image_url ?? "",
  timezone: r.timezone,
  session_duration_minutes: String(r.session_duration_minutes),
  slot_step_minutes: r.slot_step_minutes === null ? "" : String(r.slot_step_minutes),
  capacity: String(r.capacity),
  buffer_before_minutes: String(r.buffer_before_minutes),
  buffer_after_minutes: String(r.buffer_after_minutes),
  min_notice_minutes: String(r.min_notice_minutes),
  max_advance_days: String(r.max_advance_days),
  hold_minutes: String(r.hold_minutes),
  cancellation_window_hours: String(r.cancellation_window_hours),
})

const intInRange = (value: string, min: number, max: number): number | null => {
  if (value.trim() === "") return null
  const n = Number(value)
  return Number.isInteger(n) && n >= min && n <= max ? n : null
}

const Field = ({
  label,
  help,
  children,
}: {
  label: string
  help?: string
  children: React.ReactNode
}) => (
  <div className="flex flex-col gap-y-1">
    <Label size="small" weight="plus">
      {label}
    </Label>
    {children}
    {help ? (
      <Text size="xsmall" className="text-ui-fg-subtle">
        {help}
      </Text>
    ) : null}
  </div>
)

export const ResourceFormDrawer = ({ open, onOpenChange, resource, onSaved }: Props) => {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormState>(DEFAULTS)
  const editing = !!resource

  useEffect(() => {
    if (open) setForm(resource ? fromResource(resource) : { ...DEFAULTS, timezone: browserTimeZone() })
  }, [open, resource])

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const parsed = {
    session_duration_minutes: intInRange(form.session_duration_minutes, 1, 1440),
    slot_step_minutes: form.slot_step_minutes.trim() === "" ? null : intInRange(form.slot_step_minutes, 1, 1440),
    capacity: intInRange(form.capacity, 1, 10000),
    buffer_before_minutes: intInRange(form.buffer_before_minutes, 0, 1440),
    buffer_after_minutes: intInRange(form.buffer_after_minutes, 0, 1440),
    min_notice_minutes: intInRange(form.min_notice_minutes, 0, 525600),
    max_advance_days: intInRange(form.max_advance_days, 1, 730),
    hold_minutes: intInRange(form.hold_minutes, 1, 120),
    cancellation_window_hours: intInRange(form.cancellation_window_hours, 0, 8760),
  }

  const problem = !form.display_name.trim()
    ? "Enter a name."
    : !isKnownTimeZone(form.timezone)
      ? "Choose a valid timezone from the list."
      : parsed.session_duration_minutes === null
        ? "Session length must be 1-1440 minutes."
        : form.slot_step_minutes.trim() !== "" && parsed.slot_step_minutes === null
          ? "Slot step must be 1-1440 minutes (or empty)."
          : parsed.capacity === null
            ? "People per slot must be at least 1."
            : parsed.buffer_before_minutes === null || parsed.buffer_after_minutes === null
              ? "Buffers must be 0-1440 minutes."
              : parsed.min_notice_minutes === null
                ? "Minimum notice must be 0 or more minutes."
                : parsed.max_advance_days === null
                  ? "Booking horizon must be 1-730 days."
                  : parsed.hold_minutes === null
                    ? "Hold time must be 1-120 minutes."
                    : parsed.cancellation_window_hours === null
                      ? "Cancellation window must be 0 or more hours."
                      : form.image_url.trim() && !/^https?:\/\//i.test(form.image_url.trim())
                        ? "Photo must be a web address starting with http(s)://."
                        : null

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        display_name: form.display_name.trim(),
        kind: form.kind.trim() || "staff",
        description: form.description.trim() || null,
        image_url: form.image_url.trim() || null,
        timezone: form.timezone,
        session_duration_minutes: parsed.session_duration_minutes!,
        slot_step_minutes: parsed.slot_step_minutes,
        capacity: parsed.capacity!,
        buffer_before_minutes: parsed.buffer_before_minutes!,
        buffer_after_minutes: parsed.buffer_after_minutes!,
        min_notice_minutes: parsed.min_notice_minutes!,
        max_advance_days: parsed.max_advance_days!,
        hold_minutes: parsed.hold_minutes!,
        cancellation_window_hours: parsed.cancellation_window_hours!,
      }
      return editing
        ? updateVendorResource(resource!.id, body)
        : createVendorResource(body)
    },
    onSuccess: ({ resource: saved }) => {
      toast.success(editing ? "Resource updated" : "Resource created")
      queryClient.invalidateQueries({ queryKey: ["vendor-resources"] })
      queryClient.invalidateQueries({ queryKey: ["vendor-resource", saved.id] })
      onOpenChange(false)
      onSaved?.(saved)
    },
    onError: (error: any) => {
      toast.error(error?.message || "Could not save the resource")
    },
  })

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>{editing ? "Edit resource" : "Add resource"}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-4 overflow-y-auto">
          <Field label="Name *" help="Who or what customers book, e.g. Priya Sharma or Studio A.">
            <Input value={form.display_name} onChange={set("display_name")} maxLength={120} />
          </Field>
          <Field label="Kind" help="Staff, room, equipment... shown to customers as a label.">
            <Input value={form.kind} onChange={set("kind")} maxLength={40} />
          </Field>
          <Field label="Description">
            <Textarea value={form.description} onChange={set("description")} rows={3} maxLength={2000} />
          </Field>
          <Field label="Photo address" help="A link to an image (optional).">
            <Input value={form.image_url} onChange={set("image_url")} placeholder="https://" />
          </Field>
          <Field
            label="Timezone *"
            help="Weekly hours are in this timezone. Customers see times in their own."
          >
            <Input value={form.timezone} onChange={set("timezone")} list="appointment-timezones" />
            <datalist id="appointment-timezones">
              {getTimeZones().map((zone) => (
                <option key={zone} value={zone} />
              ))}
            </datalist>
          </Field>

          <div className="border-ui-border-base border-t pt-4">
            <Text weight="plus" className="mb-3">
              Booking rules
            </Text>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Session length (min)" help="How long one booking lasts.">
                <Input type="number" min={1} value={form.session_duration_minutes} onChange={set("session_duration_minutes")} />
              </Field>
              <Field label="Slot starts every (min)" help="Empty = same as session length.">
                <Input type="number" min={1} value={form.slot_step_minutes} onChange={set("slot_step_minutes")} />
              </Field>
              <Field label="People per slot" help="1 = private, more = group session.">
                <Input type="number" min={1} value={form.capacity} onChange={set("capacity")} />
              </Field>
              <Field label="Hold while paying (min)" help="How long a slot is kept for a buyer at checkout.">
                <Input type="number" min={1} value={form.hold_minutes} onChange={set("hold_minutes")} />
              </Field>
              <Field label="Buffer before (min)" help="Free time kept before each booking.">
                <Input type="number" min={0} value={form.buffer_before_minutes} onChange={set("buffer_before_minutes")} />
              </Field>
              <Field label="Buffer after (min)" help="Free time kept after each booking.">
                <Input type="number" min={0} value={form.buffer_after_minutes} onChange={set("buffer_after_minutes")} />
              </Field>
              <Field label="Minimum notice (min)" help="Earliest a customer can book from now.">
                <Input type="number" min={0} value={form.min_notice_minutes} onChange={set("min_notice_minutes")} />
              </Field>
              <Field label="Book up to (days ahead)" help="How far in advance customers can book.">
                <Input type="number" min={1} value={form.max_advance_days} onChange={set("max_advance_days")} />
              </Field>
              <Field label="Customers may cancel until (hours before)" help="0 = until the start.">
                <Input type="number" min={0} value={form.cancellation_window_hours} onChange={set("cancellation_window_hours")} />
              </Field>
            </div>
            <Text size="xsmall" className="text-ui-fg-subtle mt-3">
              Changes apply to future bookings. Existing bookings keep the buffers and
              capacity they were made with.
            </Text>
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <div className="flex w-full items-center justify-between gap-x-2">
            <Text size="small" className="text-ui-fg-error">
              {problem}
            </Text>
            <div className="flex gap-x-2">
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => save.mutate()}
                disabled={!!problem || save.isPending}
                isLoading={save.isPending}
              >
                {editing ? "Save" : "Create"}
              </Button>
            </div>
          </div>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}
