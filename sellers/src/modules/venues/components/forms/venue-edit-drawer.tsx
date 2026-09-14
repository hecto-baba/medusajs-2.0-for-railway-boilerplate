"use client"

import {
  updateVendorVenue,
  type VendorRowType,
  type VendorVenue,
  type VendorVenueRow,
} from "@lib/data/vendor-client"
import {
  Button,
  Drawer,
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
import { useEffect, useState } from "react"
import { ROW_TYPES, ROW_TYPE_STYLES, SeatChart } from "../common/seat-chart"

type VenueEditDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  venue: VendorVenue
  onSuccess?: () => void
}

export const VenueEditDrawer = ({
  open,
  onOpenChange,
  venue,
  onSuccess,
}: VenueEditDrawerProps) => {
  const queryClient = useQueryClient()

  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [rows, setRows] = useState<VendorVenueRow[]>([])

  useEffect(() => {
    if (venue) {
      setName(venue.name || "")
      setAddress(venue.address || "")
      setRows(
        (venue.rows || []).map((r) => ({
          id: r.id,
          row_number: r.row_number,
          row_type: r.row_type,
          seat_count: r.seat_count,
        }))
      )
    }
  }, [venue, open])

  const addRow = () => {
    const nextRowLetter = String.fromCharCode(65 + (rows.length % 26))
    setRows((prev) => [
      ...prev,
      {
        row_number: nextRowLetter,
        row_type: "standard",
        seat_count: 10,
      },
    ])
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

  const updateMutation = useMutation({
    mutationFn: () =>
      updateVendorVenue(venue.id, {
        name: name.trim(),
        address: address.trim() || null,
        rows: rows.map((r) => ({
          id: r.id,
          row_number: r.row_number.trim().toUpperCase(),
          row_type: r.row_type,
          seat_count: Number(r.seat_count),
        })),
      }),
    onSuccess: () => {
      toast.success("Venue updated successfully")
      queryClient.invalidateQueries({
        queryKey: ["vendor-venue", venue.id],
      })
      queryClient.invalidateQueries({ queryKey: ["vendor-venues"] })
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update venue")
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error("Venue name is required")
      return
    }

    if (!rows.length) {
      toast.error("At least one row is required")
      return
    }

    updateMutation.mutate()
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content className="max-w-xl">
        <Drawer.Header>
          <Drawer.Title asChild>
            <Heading level="h2">Edit Venue</Heading>
          </Drawer.Title>
          <Drawer.Description className="text-ui-fg-subtle text-sm">
            Update venue location, row layouts, and seating tiers.
          </Drawer.Description>
        </Drawer.Header>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col justify-between overflow-hidden">
          <Drawer.Body className="flex flex-col gap-y-6 p-6 overflow-y-auto">
            {/* General Info */}
            <div className="flex flex-col gap-y-4">
              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  Venue Name <span className="text-ui-fg-error">*</span>
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  Address
                </Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Venue address"
                />
              </div>
            </div>

            {/* Seating Rows */}
            <div className="flex flex-col gap-y-3">
              <div className="flex items-center justify-between">
                <Label size="small" weight="plus">
                  Seating Rows ({rows.length})
                </Label>
                <Button size="small" variant="secondary" type="button" onClick={addRow}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Row
                </Button>
              </div>

              <div className="flex flex-col gap-y-2 max-h-64 overflow-y-auto pr-1">
                {rows.map((row, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 bg-ui-bg-subtle p-2.5 rounded-lg border border-ui-border-base"
                  >
                    <div className="w-16">
                      <Input
                        value={row.row_number}
                        onChange={(e) =>
                          updateRow(index, { row_number: e.target.value })
                        }
                        className="text-center font-bold"
                      />
                    </div>

                    <div className="flex-1">
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

                    <div className="w-20">
                      <Input
                        type="number"
                        min={1}
                        value={row.seat_count || ""}
                        onChange={(e) =>
                          updateRow(index, {
                            seat_count: parseInt(e.target.value, 10) || 0,
                          })
                        }
                        className="text-center"
                      />
                    </div>

                    <IconButton
                      variant="transparent"
                      size="small"
                      type="button"
                      onClick={() => removeRow(index)}
                      disabled={rows.length <= 1}
                      aria-label="Remove row"
                    >
                      <Trash className="h-4 w-4 text-ui-fg-muted hover:text-ui-fg-error" />
                    </IconButton>
                  </div>
                ))}
              </div>
            </div>

            {/* Seat Chart Live Preview */}
            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Seating Plan Preview
              </Label>
              <SeatChart rows={rows} maxSeatsPerRow={16} />
            </div>
          </Drawer.Body>

          <Drawer.Footer className="border-t p-4 flex items-center justify-end gap-x-2">
            <Button
              variant="secondary"
              size="small"
              type="button"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="small"
              type="submit"
              isLoading={updateMutation.isPending}
            >
              Save Changes
            </Button>
          </Drawer.Footer>
        </form>
      </Drawer.Content>
    </Drawer>
  )
}
