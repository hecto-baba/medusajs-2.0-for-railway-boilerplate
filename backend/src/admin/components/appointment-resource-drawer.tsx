import {
  Button,
  Drawer,
  Input,
  Label,
  Select,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { sdk } from "../lib/sdk"
import { browserTimeZone, getTimeZones, isKnownTimeZone } from "../lib/appointment-format"
import { Provider } from "../types/appointment-booking"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Present = edit; absent = create on a vendor's behalf. */
  resource?: Provider | null
  onSaved?: (resource: Provider) => void
}

const DEFAULTS = {
  vendor_id: "",
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
type Form = typeof DEFAULTS

const fromResource = (r: Provider): Form => ({
  vendor_id: r.vendor_id ?? "",
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

const Field = ({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-y-1">
    <Label size="small" weight="plus">{label}</Label>
    {children}
    {help ? <Text size="xsmall" className="text-ui-fg-subtle">{help}</Text> : null}
  </div>
)

export const AppointmentResourceDrawer = ({ open, onOpenChange, resource, onSaved }: Props) => {
  const queryClient = useQueryClient()
  const editing = !!resource
  const [form, setForm] = useState<Form>(DEFAULTS)

  useEffect(() => {
    if (open) setForm(resource ? fromResource(resource) : { ...DEFAULTS, timezone: browserTimeZone() })
  }, [open, resource])

  const { data: vendorsData } = useQuery<{ vendors: { id: string; name: string }[] }>({
    queryKey: [["admin-vendors-for-resources"]],
    queryFn: () => sdk.client.fetch("/admin/vendors", { query: { limit: 200 } }),
    enabled: open && !editing,
  })

  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const p = {
    session: intInRange(form.session_duration_minutes, 1, 1440),
    step: form.slot_step_minutes.trim() === "" ? null : intInRange(form.slot_step_minutes, 1, 1440),
    capacity: intInRange(form.capacity, 1, 10000),
    before: intInRange(form.buffer_before_minutes, 0, 1440),
    after: intInRange(form.buffer_after_minutes, 0, 1440),
    notice: intInRange(form.min_notice_minutes, 0, 525600),
    advance: intInRange(form.max_advance_days, 1, 730),
    hold: intInRange(form.hold_minutes, 1, 120),
    cancel: intInRange(form.cancellation_window_hours, 0, 8760),
  }

  const problem = !editing && !form.vendor_id
    ? "Choose the business this resource belongs to."
    : !form.display_name.trim()
      ? "Enter a name."
      : !isKnownTimeZone(form.timezone)
        ? "Choose a valid timezone."
        : p.session === null
          ? "Session length must be 1-1440 minutes."
          : form.slot_step_minutes.trim() !== "" && p.step === null
            ? "Slot step must be 1-1440 minutes (or empty)."
            : p.capacity === null
              ? "People per slot must be at least 1."
              : p.before === null || p.after === null
                ? "Buffers must be 0-1440 minutes."
                : p.notice === null
                  ? "Minimum notice must be 0 or more minutes."
                  : p.advance === null
                    ? "Booking horizon must be 1-730 days."
                    : p.hold === null
                      ? "Hold time must be 1-120 minutes."
                      : p.cancel === null
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
        session_duration_minutes: p.session!,
        slot_step_minutes: p.step,
        capacity: p.capacity!,
        buffer_before_minutes: p.before!,
        buffer_after_minutes: p.after!,
        min_notice_minutes: p.notice!,
        max_advance_days: p.advance!,
        hold_minutes: p.hold!,
        cancellation_window_hours: p.cancel!,
      }
      return editing
        ? sdk.client.fetch<{ provider: Provider }>(`/admin/providers/${resource!.id}`, {
            method: "POST",
            body,
          })
        : sdk.client
            .fetch<{ resource: Provider }>("/admin/providers", {
              method: "POST",
              body: { ...body, vendor_id: form.vendor_id },
            })
            .then((r) => ({ provider: r.resource }))
    },
    onSuccess: ({ provider }) => {
      toast.success(editing ? "Resource updated" : "Resource created")
      queryClient.invalidateQueries({ queryKey: [["admin-providers"]] })
      queryClient.invalidateQueries({ queryKey: [["admin-provider", provider.id]] })
      onOpenChange(false)
      onSaved?.(provider)
    },
    onError: (error: any) => toast.error(error?.message || "Could not save the resource"),
  })

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>{editing ? "Edit resource" : "Create resource for a business"}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-4 overflow-y-auto">
          {!editing ? (
            <Field label="Business *">
              <Select value={form.vendor_id} onValueChange={(v) => setForm((f) => ({ ...f, vendor_id: v }))}>
                <Select.Trigger><Select.Value placeholder="Choose a business" /></Select.Trigger>
                <Select.Content>
                  {(vendorsData?.vendors ?? []).map((v) => (
                    <Select.Item key={v.id} value={v.id}>{v.name}</Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </Field>
          ) : null}
          <Field label="Name *"><Input value={form.display_name} onChange={set("display_name")} maxLength={120} /></Field>
          <Field label="Kind" help="Staff, room, equipment...">
            <Input value={form.kind} onChange={set("kind")} maxLength={40} />
          </Field>
          <Field label="Description"><Textarea value={form.description} onChange={set("description")} rows={3} maxLength={2000} /></Field>
          <Field label="Photo address"><Input value={form.image_url} onChange={set("image_url")} placeholder="https://" /></Field>
          <Field label="Timezone *" help="Weekly hours are in this timezone.">
            <Input value={form.timezone} onChange={set("timezone")} list="admin-appointment-timezones" />
            <datalist id="admin-appointment-timezones">
              {getTimeZones().map((z) => <option key={z} value={z} />)}
            </datalist>
          </Field>

          <div className="border-ui-border-base border-t pt-4">
            <Text weight="plus" className="mb-3">Booking rules</Text>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Session length (min)"><Input type="number" min={1} value={form.session_duration_minutes} onChange={set("session_duration_minutes")} /></Field>
              <Field label="Slot starts every (min)" help="Empty = session length."><Input type="number" min={1} value={form.slot_step_minutes} onChange={set("slot_step_minutes")} /></Field>
              <Field label="People per slot"><Input type="number" min={1} value={form.capacity} onChange={set("capacity")} /></Field>
              <Field label="Hold while paying (min)"><Input type="number" min={1} value={form.hold_minutes} onChange={set("hold_minutes")} /></Field>
              <Field label="Buffer before (min)"><Input type="number" min={0} value={form.buffer_before_minutes} onChange={set("buffer_before_minutes")} /></Field>
              <Field label="Buffer after (min)"><Input type="number" min={0} value={form.buffer_after_minutes} onChange={set("buffer_after_minutes")} /></Field>
              <Field label="Minimum notice (min)"><Input type="number" min={0} value={form.min_notice_minutes} onChange={set("min_notice_minutes")} /></Field>
              <Field label="Book up to (days ahead)"><Input type="number" min={1} value={form.max_advance_days} onChange={set("max_advance_days")} /></Field>
              <Field label="Cancel until (hours before)"><Input type="number" min={0} value={form.cancellation_window_hours} onChange={set("cancellation_window_hours")} /></Field>
            </div>
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <div className="flex w-full items-center justify-between gap-x-2">
            <Text size="small" className="text-ui-fg-error">{problem}</Text>
            <div className="flex gap-x-2">
              <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={() => save.mutate()} disabled={!!problem || save.isPending} isLoading={save.isPending}>
                {editing ? "Save" : "Create"}
              </Button>
            </div>
          </div>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}
