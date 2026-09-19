"use client"

import { createVendorRecurringAvailability } from "@lib/data/vendor-client"
import {
  Button,
  FocusModal,
  Heading,
  Input,
  Label,
  Select,
  Text,
  toast,
} from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]

type RecurringAvailabilityCreateModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export const RecurringAvailabilityCreateModal = ({
  open,
  onOpenChange,
  onSuccess,
}: RecurringAvailabilityCreateModalProps) => {
  const queryClient = useQueryClient()

  const [dayOfWeek, setDayOfWeek] = useState("1")
  const [startTime, setStartTime] = useState("09:00")
  const [endTime, setEndTime] = useState("17:00")
  const [effectiveFrom, setEffectiveFrom] = useState(
    new Date().toISOString().slice(0, 10)
  )
  const [effectiveUntil, setEffectiveUntil] = useState("")

  const resetForm = () => {
    setDayOfWeek("1")
    setStartTime("09:00")
    setEndTime("17:00")
    setEffectiveFrom(new Date().toISOString().slice(0, 10))
    setEffectiveUntil("")
  }

  const validationError =
    startTime >= endTime
      ? "Start time must be before end time"
      : !effectiveFrom
        ? "An effective-from date is required"
        : null

  const createMutation = useMutation({
    mutationFn: () =>
      createVendorRecurringAvailability({
        day_of_week: Number(dayOfWeek),
        start_time: startTime,
        end_time: endTime,
        effective_from: effectiveFrom,
        effective_until: effectiveUntil || null,
      }),
    onSuccess: () => {
      toast.success("Recurring hours added")
      queryClient.invalidateQueries({ queryKey: ["vendor-recurring-availability"] })
      resetForm()
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (error: any) => {
      toast.error(error?.message || "Could not add recurring hours")
    },
  })

  return (
    <FocusModal
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) resetForm()
      }}
    >
      <FocusModal.Content>
        <FocusModal.Header>
          <div className="flex w-full items-center justify-end gap-2">
            <Button
              size="small"
              onClick={() => createMutation.mutate()}
              isLoading={createMutation.isPending}
              disabled={!!validationError}
            >
              Add hours
            </Button>
          </div>
        </FocusModal.Header>

        <FocusModal.Body className="flex flex-col items-center overflow-y-auto py-10">
          <div className="flex w-full max-w-lg flex-col gap-6 px-6">
            <div>
              <Heading level="h2">Recurring hours</Heading>
              <Text size="small" className="text-ui-fg-subtle">
                Repeats every week on the day you choose, starting from the
                effective-from date.
              </Text>
            </div>

            <div className="flex flex-col gap-2">
              <Label size="small" weight="plus">
                Day of week
              </Label>
              <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {DAY_NAMES.map((name, index) => (
                    <Select.Item key={index} value={String(index)}>
                      {name}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label size="small" weight="plus">
                  Start time
                </Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label size="small" weight="plus">
                  End time
                </Label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label size="small" weight="plus">
                  Effective from
                </Label>
                <Input
                  type="date"
                  value={effectiveFrom}
                  onChange={(event) => setEffectiveFrom(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label size="small" weight="plus">
                  Effective until
                  <span className="text-ui-fg-muted"> (optional)</span>
                </Label>
                <Input
                  type="date"
                  value={effectiveUntil}
                  onChange={(event) => setEffectiveUntil(event.target.value)}
                />
              </div>
            </div>

            {validationError && (
              <Text size="small" className="text-ui-fg-error">
                {validationError}
              </Text>
            )}
          </div>
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  )
}

export default RecurringAvailabilityCreateModal
