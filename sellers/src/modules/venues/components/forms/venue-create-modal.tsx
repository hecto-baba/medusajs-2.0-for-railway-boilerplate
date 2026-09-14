"use client"

import {
  createVendorVenue,
  type VendorRowType,
  type VendorVenueRow,
} from "@lib/data/vendor-client"
import {
  Button,
  FocusModal,
  Heading,
  IconButton,
  Input,
  Label,
  Select,
  Text,
  toast,
} from "@medusajs/ui"
import { Plus, Trash } from "@medusajs/icons"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { ROW_TYPES, ROW_TYPE_STYLES, SeatChart } from "../common/seat-chart"

type VenueCreateModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (venueId: string) => void
}

const emptyRow = (index: number): VendorVenueRow => ({
  row_number: String.fromCharCode(65 + (index % 26)),
  row_type: "standard",
  seat_count: 10,
})

export const VenueCreateModal = ({
  open,
  onOpenChange,
  onSuccess,
}: VenueCreateModalProps) => {
  const queryClient = useQueryClient()

  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [rows, setRows] = useState<VendorVenueRow[]>([
    emptyRow(0),
    emptyRow(1),
    emptyRow(2),
  ])

  const resetForm = () => {
    setName("")
    setAddress("")
    setRows([emptyRow(0), emptyRow(1), emptyRow(2)])
  }

  const addRow = () => {
    setRows((prev) => [...prev, emptyRow(prev.length)])
  }

  const removeRow = (index: number) => {
    if (rows.length <= 1) {
      toast.error("A venue must have at least one row.")
      return
    }
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  const updateRow = (index: number, patch: Partial<VendorVenueRow>) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    )
  }

  const duplicateRowNumbers = rows
    .map((row) => row.row_number.trim().toUpperCase())
    .filter((num, idx, all) => (num ? all.indexOf(num) !== idx : false))

  const validationError = (() => {
    if (!name.trim()) return "A venue name is required"
    if (!rows.length) return "A venue needs at least one row"
    if (rows.some((row) => !row.row_number.trim()))
      return "Every row needs a row number or letter"
    if (duplicateRowNumbers.length)
      return `Duplicate row number: ${duplicateRowNumbers[0]}`
    if (rows.some((row) => !row.seat_count || row.seat_count < 1))
      return "Every row needs at least 1 seat"
    return null
  })()

  const createMutation = useMutation({
    mutationFn: () =>
      createVendorVenue({
        name: name.trim(),
        address: address.trim() || undefined,
        rows: rows.map((r) => ({
          row_number: r.row_number.trim().toUpperCase(),
          row_type: r.row_type,
          seat_count: Number(r.seat_count),
        })),
      }),
    onSuccess: (data) => {
      toast.success(`Venue "${name.trim()}" created successfully`)
      queryClient.invalidateQueries({ queryKey: ["vendor-venues"] })
      onOpenChange(false)
      const createdId = data.venue.id
      resetForm()
      onSuccess?.(createdId)
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create venue")
    },
  })

  const handleSubmit = () => {
    if (validationError) {
      toast.error(validationError)
      return
    }
    createMutation.mutate()
  }

  return (
    <FocusModal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) resetForm()
        onOpenChange(nextOpen)
      }}
    >
      <FocusModal.Content className="flex flex-col">
        <FocusModal.Header className="flex items-center justify-between border-b p-4">
          <div>
            <FocusModal.Title asChild>
              <Heading level="h2">Create Venue</Heading>
            </FocusModal.Title>
            <FocusModal.Description asChild>
              <Text size="small" className="text-ui-fg-subtle">
                Define a performance location, seating tiers, and stage plan.
              </Text>
            </FocusModal.Description>
          </div>

          <div className="flex items-center gap-x-2">
            <Button
              variant="secondary"
              size="small"
              onClick={() => {
                resetForm()
                onOpenChange(false)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="small"
              onClick={handleSubmit}
              isLoading={createMutation.isPending}
            >
              Save Venue
            </Button>
          </div>
        </FocusModal.Header>

        <FocusModal.Body className="flex flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full gap-8">
          {/* Left Form Column */}
          <div className="flex flex-col gap-y-6 flex-1 max-w-xl">
            {/* General Info */}
            <div className="flex flex-col gap-y-4">
              <Heading level="h3" className="text-ui-fg-base">
                Venue Details
              </Heading>

              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  Venue Name <span className="text-ui-fg-error">*</span>
                </Label>
                <Input
                  placeholder="Royal Hall, Stage A, etc."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  Address or Location
                </Label>
                <Input
                  placeholder="123 Broadway, New York, NY"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
            </div>

            {/* Seating Rows Section */}
            <div className="flex flex-col gap-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Heading level="h3" className="text-ui-fg-base">
                    Seating Rows & Tiers
                  </Heading>
                  <Text size="small" className="text-ui-fg-subtle">
                    Configure row letters, seating tiers, and capacities.
                  </Text>
                </div>
                <Button size="small" variant="secondary" onClick={addRow}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Row
                </Button>
              </div>

              <div className="flex flex-col gap-y-2.5">
                {rows.map((row, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 bg-ui-bg-subtle p-3 rounded-lg border border-ui-border-base"
                  >
                    <div className="w-24 flex flex-col gap-y-1">
                      <Label size="xsmall" className="text-ui-fg-subtle">
                        Row
                      </Label>
                      <Input
                        value={row.row_number}
                        onChange={(e) =>
                          updateRow(index, { row_number: e.target.value })
                        }
                        placeholder="A"
                        className="text-center font-bold"
                      />
                    </div>

                    <div className="flex-1 flex flex-col gap-y-1">
                      <Label size="xsmall" className="text-ui-fg-subtle">
                        Seating Tier
                      </Label>
                      <Select
                        value={row.row_type}
                        onValueChange={(val: any) =>
                          updateRow(index, { row_type: val })
                        }
                      >
                        <Select.Trigger>
                          <Select.Value />
                        </Select.Trigger>
                        <Select.Content>
                          {ROW_TYPES.map((type) => (
                            <Select.Item key={type} value={type}>
                              {ROW_TYPE_STYLES[type].label}
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select>
                    </div>

                    <div className="w-28 flex flex-col gap-y-1">
                      <Label size="xsmall" className="text-ui-fg-subtle">
                        Seats
                      </Label>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={row.seat_count || ""}
                        onChange={(e) =>
                          updateRow(index, {
                            seat_count: parseInt(e.target.value, 10) || 0,
                          })
                        }
                        className="text-center"
                      />
                    </div>

                    <div className="pt-5">
                      <IconButton
                        variant="transparent"
                        size="small"
                        onClick={() => removeRow(index)}
                        disabled={rows.length <= 1}
                        aria-label="Remove row"
                      >
                        <Trash className="h-4 w-4 text-ui-fg-muted hover:text-ui-fg-error" />
                      </IconButton>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Live Seating Plan Preview */}
          <div className="flex flex-col gap-y-3 flex-1">
            <Heading level="h3" className="text-ui-fg-base">
              Live Seating Chart Preview
            </Heading>
            <SeatChart rows={rows} />
          </div>
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  )
}
