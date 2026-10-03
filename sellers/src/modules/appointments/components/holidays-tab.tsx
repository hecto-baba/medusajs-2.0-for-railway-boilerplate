"use client"

import {
  createVendorResourceException,
  deleteVendorResourceException,
  listVendorResourceExceptions,
  updateVendorResourceException,
  type VendorResource,
  type VendorResourceException,
} from "@lib/data/vendor-client"
import {
  Badge,
  Button,
  Container,
  FocusModal,
  Heading,
  IconButton,
  Input,
  Label,
  Table,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { PencilSquare, Trash } from "@medusajs/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { formatCalendarDate, todayKey } from "../lib/format"

type Mode = "day_off" | "time_off" | "extra_hours"

const modeOf = (e: VendorResourceException): Mode =>
  e.type === "extra_hours" ? "extra_hours" : e.start_time && e.end_time ? "time_off" : "day_off"

/** Adds a holiday, or edits one when `entry` is given. Remount (key) per entry. */
const HolidayModal = ({
  resource,
  entry,
  open,
  onOpenChange,
}: {
  resource: VendorResource
  entry?: VendorResourceException | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) => {
  const queryClient = useQueryClient()
  const [date, setDate] = useState(entry ? entry.date.slice(0, 10) : todayKey(resource.timezone))
  const [mode, setMode] = useState<Mode>(entry ? modeOf(entry) : "day_off")
  const [start, setStart] = useState(entry?.start_time ?? "14:00")
  const [end, setEnd] = useState(entry?.end_time ?? "16:00")
  const [reason, setReason] = useState(entry?.reason ?? "")

  const timed = mode !== "day_off"
  const problem = !date
    ? "Choose a date."
    : timed && (!start || !end)
      ? "Enter a start and end time."
      : timed && start >= end
        ? "Start time must be before end time."
        : null

  const add = useMutation({
    mutationFn: () => {
      const body = {
        date,
        type: mode === "extra_hours" ? ("extra_hours" as const) : ("blackout" as const),
        start_time: timed ? start : null,
        end_time: timed ? end : null,
        reason: reason.trim() || null,
      }
      return entry
        ? updateVendorResourceException(resource.id, entry.id, body)
        : createVendorResourceException(resource.id, body)
    },
    onSuccess: () => {
      toast.success(
        entry ? "Changes saved" : mode === "extra_hours" ? "Extra hours added" : "Time blocked off"
      )
      queryClient.invalidateQueries({ queryKey: ["vendor-resource-exceptions", resource.id] })
      queryClient.invalidateQueries({ queryKey: ["vendor-slots-preview", resource.id] })
      onOpenChange(false)
    },
    onError: (e: any) => toast.error(e?.message || (entry ? "Could not save changes" : "Could not add this")),
  })

  const option = (value: Mode, label: string) => (
    <label key={value} className="flex cursor-pointer items-center gap-x-2">
      <input
        type="radio"
        name="holiday-mode"
        checked={mode === value}
        onChange={() => setMode(value)}
      />
      <Text size="small">{label}</Text>
    </label>
  )

  return (
    <FocusModal open={open} onOpenChange={onOpenChange}>
      <FocusModal.Content>
        <FocusModal.Header>
          <FocusModal.Title>{entry ? "Edit holiday or special hours" : "Add holiday or special hours"}</FocusModal.Title>
        </FocusModal.Header>
        <FocusModal.Body className="flex flex-col items-center overflow-y-auto py-8">
          <div className="flex w-full max-w-lg flex-col gap-y-5">
            <div className="flex flex-col gap-y-1">
              <Label size="small" weight="plus">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-y-2">
              {option("day_off", "Whole day off")}
              {option("time_off", "Time off during the day")}
              {option("extra_hours", "Extra working hours")}
            </div>
            {timed ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-y-1">
                  <Label size="small" weight="plus">From</Label>
                  <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
                </div>
                <div className="flex flex-col gap-y-1">
                  <Label size="small" weight="plus">To</Label>
                  <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
                </div>
              </div>
            ) : null}
            <div className="flex flex-col gap-y-1">
              <Label size="small" weight="plus">Reason (optional)</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
            </div>
            <Text size="small" className="text-ui-fg-subtle">
              Times are in {resource.timezone}. Time that already has bookings cannot be
              blocked - cancel those bookings first.
            </Text>
            <Text size="small" className="text-ui-fg-error">{problem}</Text>
          </div>
        </FocusModal.Body>
        <FocusModal.Footer>
          <div className="flex gap-x-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => add.mutate()} disabled={!!problem || add.isPending} isLoading={add.isPending}>
              {entry ? "Save" : "Add"}
            </Button>
          </div>
        </FocusModal.Footer>
      </FocusModal.Content>
    </FocusModal>
  )
}

const describe = (e: VendorResourceException) => {
  if (e.type === "extra_hours") return { label: "Extra hours", color: "green" as const }
  return e.start_time && e.end_time
    ? { label: "Time off", color: "orange" as const }
    : { label: "Day off", color: "red" as const }
}

export const HolidaysTab = ({ resource }: { resource: VendorResource }) => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<VendorResourceException | null>(null)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["vendor-resource-exceptions", resource.id],
    queryFn: () => listVendorResourceExceptions(resource.id),
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteVendorResourceException(resource.id, id),
    onSuccess: () => {
      toast.success("Removed")
      queryClient.invalidateQueries({ queryKey: ["vendor-resource-exceptions", resource.id] })
      queryClient.invalidateQueries({ queryKey: ["vendor-slots-preview", resource.id] })
    },
    onError: (e: any) => toast.error(e?.message || "Could not remove this"),
  })

  const confirmRemove = async (e: VendorResourceException) => {
    const ok = await prompt({
      title: "Remove this entry?",
      description: "The day goes back to your normal weekly hours.",
      confirmText: "Remove",
      cancelText: "Cancel",
      variant: "danger",
    })
    if (ok) remove.mutate(e.id)
  }

  const today = todayKey(resource.timezone)
  const entries = [...(data?.availability_exceptions ?? [])].sort((a, b) =>
    a.date.localeCompare(b.date)
  )
  const upcoming = entries.filter((e) => e.date.slice(0, 10) >= today)
  const past = entries.filter((e) => e.date.slice(0, 10) < today)

  const rows = (list: VendorResourceException[]) =>
    list.map((e) => {
      const kind = describe(e)
      return (
        <Table.Row key={e.id}>
          <Table.Cell><Text size="small" weight="plus">{formatCalendarDate(e.date)}</Text></Table.Cell>
          <Table.Cell><Badge size="2xsmall" color={kind.color}>{kind.label}</Badge></Table.Cell>
          <Table.Cell>{e.start_time && e.end_time ? `${e.start_time} – ${e.end_time}` : "All day"}</Table.Cell>
          <Table.Cell>{e.reason || "—"}</Table.Cell>
          <Table.Cell className="text-right">
            <div className="flex items-center justify-end gap-x-1">
              <IconButton size="small" variant="transparent" aria-label="Edit" onClick={() => setEditing(e)}>
                <PencilSquare />
              </IconButton>
              <IconButton size="small" variant="transparent" aria-label="Remove" onClick={() => confirmRemove(e)}>
                <Trash />
              </IconButton>
            </div>
          </Table.Cell>
        </Table.Row>
      )
    })

  const header = (
    <Table.Header>
      <Table.Row>
        <Table.HeaderCell>Date</Table.HeaderCell>
        <Table.HeaderCell>Type</Table.HeaderCell>
        <Table.HeaderCell>Hours</Table.HeaderCell>
        <Table.HeaderCell>Reason</Table.HeaderCell>
        <Table.HeaderCell />
      </Table.Row>
    </Table.Header>
  )

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">Holidays and special hours</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Days off, time off, and extra hours that override the weekly hours.
          </Text>
        </div>
        <Button size="small" variant="secondary" onClick={() => setAdding(true)}>
          Add
        </Button>
      </div>

      {isLoading ? (
        <div className="px-6 py-8"><Text size="small" className="text-ui-fg-subtle">Loading...</Text></div>
      ) : isError ? (
        <div className="px-6 py-8"><Text size="small" className="text-ui-fg-error">{(error as Error)?.message}</Text></div>
      ) : !entries.length ? (
        <div className="px-6 py-10 text-center">
          <Text size="small" className="text-ui-fg-subtle">No holidays or special hours yet.</Text>
        </div>
      ) : (
        <>
          {upcoming.length ? (
            <Table>{header}<Table.Body>{rows(upcoming)}</Table.Body></Table>
          ) : (
            <div className="px-6 py-6"><Text size="small" className="text-ui-fg-subtle">Nothing upcoming.</Text></div>
          )}
          {past.length ? (
            <div>
              <div className="px-6 pt-4"><Text size="small" weight="plus" className="text-ui-fg-subtle">Past</Text></div>
              <Table>{header}<Table.Body>{rows(past.reverse())}</Table.Body></Table>
            </div>
          ) : null}
        </>
      )}

      <HolidayModal key="new" resource={resource} open={adding} onOpenChange={setAdding} />
      {editing ? (
        <HolidayModal
          key={editing.id}
          resource={resource}
          entry={editing}
          open
          onOpenChange={(o) => !o && setEditing(null)}
        />
      ) : null}
    </Container>
  )
}
