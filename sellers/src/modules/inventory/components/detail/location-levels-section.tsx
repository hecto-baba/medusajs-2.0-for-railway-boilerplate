"use client"

import {
  deleteVendorItemLocationLevel,
  type VendorInventoryItem,
  type VendorInventoryLevel,
} from "@lib/data/vendor-client"
import { ActionMenu, PlaceholderCell } from "@modules/common"
import {
  Button,
  Container,
  Heading,
  Table,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { PencilSquare, Trash } from "@medusajs/icons"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { ManageLocationsDrawer } from "../forms/manage-locations-drawer"
import { AdjustStockDrawer } from "../forms/adjust-stock-drawer"

export const LocationLevelsSection = ({
  item,
}: {
  item: VendorInventoryItem
}) => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const [isManageOpen, setIsManageOpen] = useState(false)
  const [selectedLevel, setSelectedLevel] = useState<VendorInventoryLevel | null>(
    null
  )

  const { mutateAsync: removeLevel } = useMutation({
    mutationFn: (locationId: string) =>
      deleteVendorItemLocationLevel(item.id, locationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-inventory-items"] })
      queryClient.invalidateQueries({
        queryKey: ["vendor-inventory-item", item.id],
      })
      toast.success("Inventory level deleted successfully.")
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete inventory level."
      )
    },
  })

  const handleDeleteLevel = async (lvl: VendorInventoryLevel) => {
    const res = await prompt({
      title: "Are you sure?",
      description:
        "You are about to delete an inventory level. This action cannot be undone.",
      confirmText: "Delete",
      cancelText: "Cancel",
    })

    if (res) {
      await removeLevel(lvl.location_id)
    }
  }

  const levels = item.location_levels ?? []

  return (
    <>
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h2">Locations</Heading>
          <Button
            size="small"
            variant="secondary"
            onClick={() => setIsManageOpen(true)}
          >
            Manage locations
          </Button>
        </div>

        {levels.length === 0 ? (
          <div className="p-6 text-center">
            <span className="text-ui-fg-subtle txt-compact-small">
              No records
            </span>
          </div>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Location</Table.HeaderCell>
                <Table.HeaderCell>Reserved</Table.HeaderCell>
                <Table.HeaderCell>In Stock</Table.HeaderCell>
                <Table.HeaderCell>Available</Table.HeaderCell>
                <Table.HeaderCell className="w-12 text-right" />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {levels.map((lvl) => {
                const locationName = Array.isArray(lvl.stock_locations)
                  ? lvl.stock_locations[0]?.name
                  : lvl.stock_locations?.name || lvl.location_id

                const stocked = Number(lvl.stocked_quantity ?? 0)
                const reserved = Number(lvl.reserved_quantity ?? 0)
                const available = stocked - reserved

                const actions = [
                  {
                    actions: [
                      {
                        icon: <PencilSquare />,
                        label: "Edit",
                        onClick: () => setSelectedLevel(lvl),
                      },
                      {
                        icon: <Trash />,
                        label: "Delete",
                        onClick: () => handleDeleteLevel(lvl),
                        disabled: reserved > 0 || stocked > 0,
                      },
                    ],
                  },
                ]

                return (
                  <Table.Row key={lvl.id}>
                    <Table.Cell>
                      <div className="flex size-full items-center overflow-hidden">
                        <span className="truncate">{locationName}</span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex size-full items-center overflow-hidden">
                        <span className="truncate">{reserved}</span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex size-full items-center overflow-hidden">
                        <span className="truncate">{stocked}</span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex size-full items-center overflow-hidden">
                        <span className="truncate">{available}</span>
                      </div>
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <ActionMenu groups={actions} />
                    </Table.Cell>
                  </Table.Row>
                )
              })}
            </Table.Body>
          </Table>
        )}
      </Container>

      <ManageLocationsDrawer
        item={item}
        open={isManageOpen}
        onOpenChange={setIsManageOpen}
      />

      {selectedLevel && (
        <AdjustStockDrawer
          item={item}
          level={selectedLevel}
          open={!!selectedLevel}
          onOpenChange={(open) => !open && setSelectedLevel(null)}
        />
      )}
    </>
  )
}
