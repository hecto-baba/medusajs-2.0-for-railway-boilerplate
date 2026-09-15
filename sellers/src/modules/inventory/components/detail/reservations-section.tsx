"use client"

import {
  deleteVendorReservation,
  getVendorTaxonomy,
  listVendorReservations,
  type VendorInventoryItem,
  type VendorReservation,
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { ReservationDrawer } from "../forms/reservation-drawer"

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

  const { data: taxonomy } = useQuery({
    queryKey: ["vendor-taxonomy"],
    queryFn: getVendorTaxonomy,
  })

  const locationMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const loc of taxonomy?.stock_locations ?? []) {
      map.set(loc.id, loc.name)
    }
    return map
  }, [taxonomy?.stock_locations])

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
      toast.success("Reservation was successfully deleted.")
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete reservation."
      )
    },
  })

  const handleDelete = async (res: VendorReservation) => {
    const confirmed = await prompt({
      title: "Are you sure?",
      description:
        "You are about to delete a reservation. This action cannot be undone.",
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
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h2">Reservations</Heading>
          <Button
            size="small"
            variant="secondary"
            onClick={() => setIsCreateOpen(true)}
          >
            Create
          </Button>
        </div>

        {isLoading ? (
          <div className="p-6 text-center">
            <span className="text-ui-fg-subtle txt-compact-small">
              Loading...
            </span>
          </div>
        ) : reservations.length === 0 ? (
          <div className="p-6 text-center">
            <span className="text-ui-fg-subtle txt-compact-small">
              No records
            </span>
          </div>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>SKU</Table.HeaderCell>
                <Table.HeaderCell>Description</Table.HeaderCell>
                <Table.HeaderCell>Location</Table.HeaderCell>
                <Table.HeaderCell>Created</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Quantity</Table.HeaderCell>
                <Table.HeaderCell className="w-12 text-right" />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {reservations.map((res) => {
                const locName = locationMap.get(res.location_id) || res.location_id
                const actions = [
                  {
                    actions: [
                      {
                        icon: <PencilSquare />,
                        label: "Edit",
                        onClick: () => setEditingReservation(res),
                      },
                      {
                        icon: <Trash />,
                        label: "Delete",
                        onClick: () => handleDelete(res),
                      },
                    ],
                  },
                ]

                return (
                  <Table.Row key={res.id}>
                    <Table.Cell>
                      <div className="flex size-full items-center overflow-hidden">
                        <span className="truncate">{item.sku || "-"}</span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex size-full items-center overflow-hidden">
                        {res.description ? (
                          <span className="truncate">{res.description}</span>
                        ) : (
                          <PlaceholderCell />
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex size-full items-center overflow-hidden">
                        <span className="truncate">{locName}</span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-ui-fg-subtle txt-compact-small">
                        {new Date(res.created_at).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <span className="truncate">{res.quantity}</span>
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
