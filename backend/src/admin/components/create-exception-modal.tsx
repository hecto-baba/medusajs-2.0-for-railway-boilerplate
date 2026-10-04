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
import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { sdk } from "../lib/sdk"
import type { AvailabilityException } from "../types/appointment-booking"

type Kind = "day_off" | "time_off" | "extra_hours"

type CreateExceptionModalProps = {
  onCreated: () => void
  endpoint: string
  /** When set, the modal edits this entry (opened immediately) instead of adding one. */
  entry?: AvailabilityException | null
  /** Called when an edit modal closes, saved or not. */
  onClose?: () => void
}

const kindOf = (e: AvailabilityException): Kind =>
  e.type === "extra_hours" ? "extra_hours" : e.start_time && e.end_time ? "time_off" : "day_off"

export const CreateExceptionModal = ({ onCreated, endpoint, entry, onClose }: CreateExceptionModalProps) => {
  const [openState, setOpen] = useState(false)
  const open = entry ? true : openState
  const [date, setDate] = useState(entry ? entry.date.slice(0, 10) : new Date().toISOString().slice(0, 10))
  const [kind, setKind] = useState<Kind>(entry ? kindOf(entry) : "day_off")
  const [startTime, setStartTime] = useState(entry?.start_time ?? "09:00")
  const [endTime, setEndTime] = useState(entry?.end_time ?? "17:00")
  const [reason, setReason] = useState(entry?.reason ?? "")
  const type = kind === "extra_hours" ? "extra_hours" : "blackout"
  const timed = kind !== "day_off"

  const reset = () => {
    setDate(new Date().toISOString().slice(0, 10))
    setKind("day_off")
    setStartTime("09:00")
    setEndTime("17:00")
    setReason("")
  }

  const validationError = (() => {
    if (!date) return "A date is required"
    if (timed && (!startTime || !endTime)) return "Enter a start and end time"
    if (timed && startTime >= endTime)
      return "Start time must be before end time"
    return null
  })()

  const createMutation = useMutation({
    mutationFn: () =>
      sdk.client.fetch(entry ? `${endpoint}/${entry.id}` : endpoint, {
        method: "POST",
        body: {
          date,
          type,
          start_time: timed ? startTime : null,
          end_time: timed ? endTime : null,
          reason: reason.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success(
        entry ? "Changes saved" : type === "blackout" ? "Time blocked off" : "Extra hours added"
      )
      reset()
      setOpen(false)
      onClose?.()
      onCreated()
    },
    onError: (error: any) => {
      toast.error(error?.message || (entry ? "Could not save changes" : "Could not add exception"))
    },
  })

  return (
    <FocusModal
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          if (!entry) reset()
          onClose?.()
        }
      }}
    >
      {entry ? null : (
        <FocusModal.Trigger asChild>
          <Button size="small" variant="secondary">
            Add exception
          </Button>
        </FocusModal.Trigger>
      )}

      <FocusModal.Content>
        <FocusModal.Header>
          <div className="flex w-full items-center justify-end gap-2">
            <Button
              size="small"
              onClick={() => createMutation.mutate()}
              isLoading={createMutation.isPending}
              disabled={!!validationError}
            >
              {entry ? "Save" : "Add exception"}
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
                value={kind}
                onValueChange={(value) => setKind(value as Kind)}
              >
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="day_off">Block off the whole day</Select.Item>
                  <Select.Item value="time_off">Block off part of the day</Select.Item>
                  <Select.Item value="extra_hours">Add extra hours</Select.Item>
                </Select.Content>
              </Select>
            </div>

            {timed && (
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

export default CreateExceptionModal
