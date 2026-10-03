"use client"

import { createVendorAvailabilityException } from "@lib/data/vendor-client"
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

type ExceptionCreateModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export const ExceptionCreateModal = ({
  open,
  onOpenChange,
  onSuccess,
}: ExceptionCreateModalProps) => {
  const queryClient = useQueryClient()

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [type, setType] = useState<"blackout" | "extra_hours">("blackout")
  const [startTime, setStartTime] = useState("09:00")
  const [endTime, setEndTime] = useState("17:00")
  const [reason, setReason] = useState("")

  const resetForm = () => {
    setDate(new Date().toISOString().slice(0, 10))
    setType("blackout")
    setStartTime("09:00")
    setEndTime("17:00")
    setReason("")
  }

  const validationError = !date
    ? "A date is required"
    : type === "extra_hours" && startTime >= endTime
      ? "Start time must be before end time"
      : null

  const createMutation = useMutation({
    mutationFn: () =>
      createVendorAvailabilityException({
        date,
        type,
        start_time: type === "extra_hours" ? startTime : null,
        end_time: type === "extra_hours" ? endTime : null,
        reason: reason.trim() || null,
      }),
    onSuccess: () => {
      toast.success(
        type === "blackout" ? "Day blocked off" : "Extra hours added"
      )
      queryClient.invalidateQueries({ queryKey: ["vendor-availability-exceptions"] })
      resetForm()
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (error: any) => {
      toast.error(error?.message || "Could not add exception")
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
              Add exception
            </Button>
          </div>
        </FocusModal.Header>

        <FocusModal.Body className="flex flex-col items-center overflow-y-auto py-10">
          <div className="flex w-full max-w-lg flex-col gap-6 px-6">
            <div>
              <Heading level="h2">Availability exception</Heading>
              <Text size="small" className="text-ui-fg-subtle">
                A one-off override for a specific date - block the day off, or
                add hours outside your normal schedule.
              </Text>
            </div>

            <div className="flex flex-col gap-2">
              <Label size="small" weight="plus">
                Date
              </Label>
              <Input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label size="small" weight="plus">
                Type
              </Label>
              <Select
                value={type}
                onValueChange={(value) => setType(value as "blackout" | "extra_hours")}
              >
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="blackout">Block off the whole day</Select.Item>
                  <Select.Item value="extra_hours">Add extra hours</Select.Item>
                </Select.Content>
              </Select>
            </div>

            {type === "extra_hours" && (
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
            )}

            <div className="flex flex-col gap-2">
              <Label size="small" weight="plus">
                Reason
                <span className="text-ui-fg-muted"> (optional)</span>
              </Label>
              <Input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Public holiday"
              />
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

export default ExceptionCreateModal
