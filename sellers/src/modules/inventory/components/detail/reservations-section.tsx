"use client"

import {
  deleteVendorReservation,
  listVendorReservations,
  type VendorInventoryItem,
  type VendorReservation,
} from "@lib/data/vendor-client"
import { ActionMenu } from "@modules/common"
import {
  Button,
  Container,
  Heading,
  Table,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { ReservationDrawer } from "../forms/reservation-drawer"

import { PencilSquare, Trash } from "@medusajs/icons"

export const ReservationsSection = ({
  item,
}: {
  item: VendorInventoryItem
}) => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingReservation, setEditingReservation] =
    useState<VendorReservation | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-reservations", item.id],
    queryFn: () =>
      listVendorReservations({
        inventory_item_id: item.id,
        limit: 50,
        offset: 0,
      }),
  })

  const { mutateAsync: remove } = useMutation({
    mutationFn: (id: string) => deleteVendorReservation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-inventory-items"] })
      queryClient.invalidateQueries({
        queryKey: ["vendor-inventory-item", item.id],
      })
      queryClient.invalidateQueries({
        queryKey: ["vendor-reservations", item.id],
      })
      toast.success("Reservation deleted.")
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete reservation."
      )
    },
  })

  const handleDelete = async (res: VendorReservation) => {
    const confirmed = await prompt({
      title: "Delete reservation",
      description: `Are you sure you want to delete this reservation of ${res.quantity} units? This will release the units back to available stock.`,
      confirmText: "Delete",
      cancelText: "Cancel",
    })

    if (confirmed) {
      await remove(res.id)
    }
  }

  const reservations = data?.reservations ?? []

  return (
    <>
      <Container className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <Heading level="h2">Reservations</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Allocated stock holds for pending orders and manual holds.
            </Text>
          </div>
          <Button
            size="small"
            variant="secondary"
            onClick={() => setIsCreateOpen(true)}
          >
            Create Reservation
          </Button>
        </div>

        {isLoading ? (
          <Text size="small" className="text-ui-fg-subtle">
            Loading reservations...
          </Text>
        ) : reservations.length === 0 ? (
          <div className="border-ui-border-base bg-ui-bg-subtle flex flex-col items-center justify-center rounded-lg border py-8 text-center">
            <Text size="small" className="text-ui-fg-subtle">
              No active reservations on this item.
            </Text>
          </div>
        ) : (
          <div className="border-ui-border-base overflow-hidden rounded-lg border">
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Description / Reference</Table.HeaderCell>
                  <Table.HeaderCell>Location ID</Table.HeaderCell>
                  <Table.HeaderCell className="text-right">
                    Quantity
                  </Table.HeaderCell>
                  <Table.HeaderCell>Created</Table.HeaderCell>
                  <Table.HeaderCell className="w-12 text-right">
                    Actions
                  </Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {reservations.map((res) => {
                  const actionGroups = [
                    {
                      actions: [
                        {
                          icon: <PencilSquare />,
                          label: "Edit reservation",
                          onClick: () => setEditingReservation(res),
                        },
                        {
                          icon: <Trash />,
                          label: "Delete reservation",
                          onClick: () => handleDelete(res),
                        },
                      ],
                    },
                  ]

                  return (
                    <Table.Row key={res.id}>
                      <Table.Cell>
                        <span className="font-medium text-ui-fg-base">
                          {res.description || res.id}
                        </span>
                      </Table.Cell>
                      <Table.Cell className="text-ui-fg-subtle font-mono txt-compact-xsmall">
                        {res.location_id}
                      </Table.Cell>
                      <Table.Cell className="text-right font-medium">
                        {res.quantity}
                      </Table.Cell>
                      <Table.Cell className="text-ui-fg-subtle txt-compact-small">
                        {new Date(res.created_at).toLocaleDateString(
                          undefined,
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          }
                        )}
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        <ActionMenu groups={actionGroups} />
                      </Table.Cell>
                    </Table.Row>
                  )
                })}
              </Table.Body>
            </Table>
          </div>
        )}
      </Container>

      {/* Create Reservation Drawer */}
      <ReservationDrawer
        item={item}
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />

      {/* Edit Reservation Drawer */}
      {editingReservation && (
        <ReservationDrawer
          item={item}
          reservation={editingReservation}
          open={!!editingReservation}
          onOpenChange={(open) => !open && setEditingReservation(null)}
        />
      )}
    </>
  )
}
