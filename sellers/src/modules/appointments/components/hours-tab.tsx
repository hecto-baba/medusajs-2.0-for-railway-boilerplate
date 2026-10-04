"use client"

import {
  createVendorResourceHours,
  deleteVendorResourceHours,
  listVendorResourceHours,
  updateVendorResourceHours,
  type VendorResource,
  type VendorWeeklyHours,
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
  Switch,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { Trash } from "@medusajs/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { DAY_NAMES, WEEK_ORDER, formatCalendarDate, todayKey } from "../lib/format"

const AddHoursModal = ({
  resource,
  open,
  onOpenChange,
}: {
  resource: VendorResource
  open: boolean
  onOpenChange: (open: boolean) => void
}) => {
  const queryClient = useQueryClient()
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [start, setStart] = useState("09:00")
  const [end, setEnd] = useState("17:00")
  const [from, setFrom] = useState(todayKey(resource.timezone))
  const [until, setUntil] = useState("")

  const problem = !days.length
    ? "Choose at least one day."
    : !start || !end
      ? "Enter a start and end time."
      : start >= end
        ? "Start time must be before end time."
        : !from
          ? "Choose the date these hours start."
          : until && until < from
            ? "The end date cannot be before the start date."
            : null

  const add = useMutation({
    mutationFn: async () => {
      // One request per weekday. Each is idempotent on the server, so a retry after
      // a partial failure does not duplicate the days that already succeeded.
      const failures: string[] = []
      for (const day of days) {
        try {
          await createVendorResourceHours(resource.id, {
            day_of_week: day,
            start_time: start,
            end_time: end,
            effective_from: from,
            effective_until: until || null,
          })
        } catch (error: any) {
          failures.push(`${DAY_NAMES[day]}: ${error?.message ?? "failed"}`)
        }
      }
      if (failures.length) throw new Error(failures.join("\n"))
    },
    onSuccess: () => {
      toast.success("Hours added")
      queryClient.invalidateQueries({ queryKey: ["vendor-resource-hours", resource.id] })
      queryClient.invalidateQueries({ queryKey: ["vendor-resource", resource.id] })
      queryClient.invalidateQueries({ queryKey: ["vendor-resources"] })
      onOpenChange(false)
    },
    onError: (error: any) => {
      toast.error("Some hours could not be added", { description: error?.message })
      queryClient.invalidateQueries({ queryKey: ["vendor-resource-hours", resource.id] })
    },
  })

  return (
    <FocusModal open={open} onOpenChange={onOpenChange}>
      <FocusModal.Content>
        <FocusModal.Header>
          <FocusModal.Title>Add weekly hours</FocusModal.Title>
        </FocusModal.Header>
        <FocusModal.Body className="flex flex-col items-center overflow-y-auto py-8">
          <div className="flex w-full max-w-lg flex-col gap-y-5">
            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">Days</Label>
              <div className="flex flex-wrap gap-2">
                {WEEK_ORDER.map((d) => (
                  <Button
                    key={d}
                    size="small"
                    variant={days.includes(d) ? "primary" : "secondary"}
                    onClick={() =>
                      setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]))
                    }
                  >
                    {DAY_NAMES[d].slice(0, 3)}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-y-1">
                <Label size="small" weight="plus">From</Label>
                <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="flex flex-col gap-y-1">
                <Label size="small" weight="plus">To</Label>
                <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
              <div className="flex flex-col gap-y-1">
                <Label size="small" weight="plus">Starting on</Label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="flex flex-col gap-y-1">
                <Label size="small" weight="plus">Until (optional)</Label>
                <Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
              </div>
            </div>
            <Text size="small" className="text-ui-fg-subtle">
              Times are in {resource.timezone}. To leave a lunch break, add two windows for
              the same day (for example 09:00-13:00 and 14:00-17:00).
            </Text>
            <Text size="small" className="text-ui-fg-error">{problem}</Text>
          </div>
        </FocusModal.Body>
        <FocusModal.Footer>
          <div className="flex gap-x-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              onClick={() => add.mutate()}
              disabled={!!problem || add.isPending}
              isLoading={add.isPending}
            >
              Add hours
            </Button>
          </div>
        </FocusModal.Footer>
      </FocusModal.Content>
    </FocusModal>
  )
}

export const HoursTab = ({ resource }: { resource: VendorResource }) => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const [adding, setAdding] = useState(false)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["vendor-resource-hours", resource.id],
    queryFn: () => listVendorResourceHours(resource.id),
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["vendor-resource-hours", resource.id] })
    queryClient.invalidateQueries({ queryKey: ["vendor-resource", resource.id] })
    queryClient.invalidateQueries({ queryKey: ["vendor-resources"] })
  }

  const toggle = useMutation({
    mutationFn: ({ rule, active }: { rule: VendorWeeklyHours; active: boolean }) =>
      updateVendorResourceHours(resource.id, rule.id, { status: active ? "active" : "inactive" }),
    onSuccess: refresh,
    onError: (e: any) => toast.error(e?.message || "Could not update the hours"),
  })

  const remove = useMutation({
    mutationFn: (ruleId: string) => deleteVendorResourceHours(resource.id, ruleId),
    onSuccess: () => {
      toast.success("Hours removed")
      refresh()
    },
    onError: (e: any) => toast.error(e?.message || "Could not remove the hours"),
  })

  const confirmRemove = async (rule: VendorWeeklyHours) => {
    const ok = await prompt({
      title: "Remove these hours?",
      description: `${DAY_NAMES[rule.day_of_week]} ${rule.start_time}-${rule.end_time} will no longer be bookable. Existing bookings are not affected.`,
      confirmText: "Remove",
      cancelText: "Cancel",
      variant: "danger",
    })
    if (ok) remove.mutate(rule.id)
  }

  const hours = data?.hours ?? []

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">Weekly hours</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            When this resource can be booked each week ({resource.timezone}).
          </Text>
        </div>
        <Button size="small" variant="secondary" onClick={() => setAdding(true)}>
          Add hours
        </Button>
      </div>

      {isLoading ? (
        <div className="px-6 py-8"><Text size="small" className="text-ui-fg-subtle">Loading...</Text></div>
      ) : isError ? (
        <div className="px-6 py-8"><Text size="small" className="text-ui-fg-error">{(error as Error)?.message}</Text></div>
      ) : (
        WEEK_ORDER.map((day) => {
          const rules = hours.filter((h) => h.day_of_week === day)
          return (
            <div key={day} className="grid grid-cols-[120px_1fr] items-start gap-x-4 px-6 py-3">
              <Text size="small" weight="plus">{DAY_NAMES[day]}</Text>
              {rules.length ? (
                <div className="flex flex-col gap-y-2">
                  {rules.map((rule) => (
                    <div key={rule.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Badge size="2xsmall" color={rule.status === "active" ? "green" : "grey"}>
                        {rule.start_time} – {rule.end_time}
                      </Badge>
                      {rule.effective_until ? (
                        <Text size="xsmall" className="text-ui-fg-subtle">
                          {formatCalendarDate(rule.effective_from)} → {formatCalendarDate(rule.effective_until)}
                        </Text>
                      ) : null}
                      <Switch
                        checked={rule.status === "active"}
                        disabled={toggle.isPending}
                        onCheckedChange={(checked) => toggle.mutate({ rule, active: checked })}
                        aria-label={`Toggle ${DAY_NAMES[day]} ${rule.start_time}`}
                      />
                      <IconButton
                        size="small"
                        variant="transparent"
                        aria-label="Remove hours"
                        onClick={() => confirmRemove(rule)}
                      >
                        <Trash />
                      </IconButton>
                    </div>
                  ))}
                </div>
              ) : (
                <Text size="small" className="text-ui-fg-muted">Closed</Text>
              )}
            </div>
          )
        })
      )}

      <AddHoursModal resource={resource} open={adding} onOpenChange={setAdding} />
    </Container>
  )
}
