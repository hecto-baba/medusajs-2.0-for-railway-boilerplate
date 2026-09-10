import {
  Button,
  FocusModal,
  Heading,
  Input,
  Label,
  Select,
  Text,
  IconButton,
  toast,
} from "@medusajs/ui"
import { Trash, Plus } from "@medusajs/icons"
import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { sdk } from "../lib/sdk"
import { ROW_TYPES, ROW_TYPE_STYLES, RowType } from "../types/ticket-booking"
import { SeatChart } from "./seat-chart"

type DraftRow = {
  row_number: string
  row_type: RowType
  seat_count: number
}

const emptyRow = (index: number): DraftRow => ({
  // A, B, C... keeps the common case typing-free while staying editable.
  row_number: String.fromCharCode(65 + index),
  row_type: RowType.STANDARD,
  seat_count: 10,
})

type CreateVenueModalProps = {
  onCreated: () => void
}

export const CreateVenueModal = ({ onCreated }: CreateVenueModalProps) => {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [rows, setRows] = useState<DraftRow[]>([emptyRow(0)])

  const reset = () => {
    setName("")
    setAddress("")
    setRows([emptyRow(0)])
  }

  const duplicateRowNumbers = rows
    .map((row) => row.row_number.trim().toUpperCase())
    .filter((rowNumber, index, all) =>
      rowNumber ? all.indexOf(rowNumber) !== index : false
    )

  const validationError = (() => {
    if (!name.trim()) return "A venue name is required"
    if (!rows.length) return "A venue needs at least one row"
    if (rows.some((row) => !row.row_number.trim()))
      return "Every row needs a row number"
    if (duplicateRowNumbers.length)
      return `Duplicate row number: ${duplicateRowNumbers[0]}`
    if (rows.some((row) => !row.seat_count || row.seat_count < 1))
      return "Every row needs at least one seat"
    return null
  })()

  const createMutation = useMutation({
    mutationFn: () =>
      sdk.client.fetch("/admin/venues", {
        method: "POST",
        body: {
          name: name.trim(),
          address: address.trim() || undefined,
          rows: rows.map((row) => ({
            row_number: row.row_number.trim().toUpperCase(),
            row_type: row.row_type,
            seat_count: Number(row.seat_count),
          })),
        },
      }),
    onSuccess: () => {
      toast.success(`Venue "${name.trim()}" created`)
      reset()
      setOpen(false)
      onCreated()
    },
    onError: (error: any) => {
      toast.error(error?.message || "Could not create the venue")
    },
  })

  const updateRow = (index: number, patch: Partial<DraftRow>) => {
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row
      )
    )
  }

  return (
    <FocusModal
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <FocusModal.Trigger asChild>
        <Button size="small" variant="secondary">
          Create venue
        </Button>
      </FocusModal.Trigger>

      <FocusModal.Content>
        <FocusModal.Header>
          <div className="flex w-full items-center justify-end gap-2">
            <Button
              size="small"
              onClick={() => createMutation.mutate()}
              isLoading={createMutation.isPending}
              disabled={!!validationError}
            >
              Create venue
            </Button>
          </div>
        </FocusModal.Header>

        <FocusModal.Body className="flex flex-col items-center overflow-y-auto py-10">
          <div className="flex w-full max-w-4xl flex-col gap-6 px-6">
            <div>
              <Heading level="h2">New venue</Heading>
              <Text size="small" className="text-ui-fg-subtle">
                Define the seating rows once; every show at this venue reuses
                them.
              </Text>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label size="small" weight="plus">
                  Name
                </Label>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="The Grand Theatre"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label size="small" weight="plus">
                  Address
                  <span className="text-ui-fg-muted"> (optional)</span>
                </Label>
                <Input
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="12 Playhouse Lane, London"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <Label size="small" weight="plus">
                  Rows
                </Label>
                <Button
                  size="small"
                  variant="secondary"
                  type="button"
                  onClick={() =>
                    setRows((current) => [...current, emptyRow(current.length)])
                  }
                >
                  <Plus /> Add row
                </Button>
              </div>

              {rows.map((row, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-3"
                >
                  <div className="flex flex-col gap-1">
                    <Label size="xsmall" className="text-ui-fg-subtle">
                      Row
                    </Label>
                    <Input
                      value={row.row_number}
                      onChange={(event) =>
                        updateRow(index, { row_number: event.target.value })
                      }
                      placeholder="A"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label size="xsmall" className="text-ui-fg-subtle">
                      Tier
                    </Label>
                    <Select
                      value={row.row_type}
                      onValueChange={(value) =>
                        updateRow(index, { row_type: value as RowType })
                      }
                    >
                      <Select.Trigger>
                        <Select.Value />
                      </Select.Trigger>
                      <Select.Content>
                        {ROW_TYPES.map((rowType) => (
                          <Select.Item key={rowType} value={rowType}>
                            {ROW_TYPE_STYLES[rowType].label}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label size="xsmall" className="text-ui-fg-subtle">
                      Seats
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      value={row.seat_count}
                      onChange={(event) =>
                        updateRow(index, {
                          seat_count: parseInt(event.target.value, 10) || 0,
                        })
                      }
                    />
                  </div>

                  <IconButton
                    type="button"
                    variant="transparent"
                    disabled={rows.length === 1}
                    onClick={() =>
                      setRows((current) =>
                        current.filter((_, rowIndex) => rowIndex !== index)
                      )
                    }
                  >
                    <Trash />
                  </IconButton>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <Label size="small" weight="plus">
                Preview
              </Label>
              <SeatChart rows={rows} />
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

export default CreateVenueModal
