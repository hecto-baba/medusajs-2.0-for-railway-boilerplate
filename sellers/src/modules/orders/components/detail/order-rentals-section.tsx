"use client"

import {
  listVendorOrderRentals,
  updateVendorRentalDeposit,
  updateVendorRentalStatus,
  type VendorRental,
  type VendorRentalDepositStatus,
  type VendorRentalUnit,
} from "@lib/data/vendor-client"
import {
  Badge,
  Button,
  Drawer,
  Heading,
  Label,
  Select,
  Table,
  Text,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { Container } from "@medusajs/ui"

const UNIT_NOUN_PLURAL: Record<VendorRentalUnit, string> = {
  hour: "hours",
  day: "days",
  week: "weeks",
  month: "months",
  custom: "days",
}

const formatStatus = (status: string) =>
  status.charAt(0).toUpperCase() + status.slice(1).replace("_", " ")

const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString()

const getStatusBadgeColor = (status: string) => {
  switch (status) {
    case "active":
      return "green"
    case "returned":
      return "blue"
    case "cancelled":
      return "red"
    case "pending":
      return "orange"
    default:
      return "grey"
  }
}

const getDepositBadgeColor = (status: VendorRentalDepositStatus | null) => {
  switch (status) {
    case "held":
      return "orange"
    case "refunded":
      return "green"
    case "partially_refunded":
      return "blue"
    case "forfeited":
      return "red"
    default:
      return "grey"
  }
}

/**
 * Rentals booked on this order, scoped to the vendor's own products.
 *
 * Mirrors the admin's order-rental-items widget field-for-field, including
 * full deposit management (refund/partial refund/forfeit) - vendors here get
 * the same deposit authority as admin, a deliberate parity decision rather
 * than a read-only view. Renders nothing when the order has no rentals, same
 * as the admin widget, so it stays invisible on non-rental orders.
 */
export const OrderRentalsSection = ({ orderId }: { orderId: string }) => {
  const queryClient = useQueryClient()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedRental, setSelectedRental] = useState<VendorRental | null>(null)
  const [newStatus, setNewStatus] = useState("")

  const { data } = useQuery({
    queryKey: ["vendor-order-rentals", orderId],
    queryFn: () => listVendorOrderRentals(orderId),
  })

  const rentals = data?.rentals ?? []

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["vendor-order-rentals", orderId] })

  // Keeps the open drawer showing fresh data after a mutation invalidates
  // and refetches the list (e.g. a deposit action while Manage is open).
  // Depends on selectedRental?.id (a stable primitive) rather than the
  // selectedRental object itself: rentals.find() returns a new object
  // reference on every refetch even when its contents are unchanged, and
  // depending on that reference would re-run this effect, call
  // setSelectedRental again, and loop.
  const selectedRentalId = selectedRental?.id
  useEffect(() => {
    if (!selectedRentalId) {
      return
    }

    const fresh = rentals.find((r) => r.id === selectedRentalId)
    if (fresh) {
      setSelectedRental(fresh)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rentals, selectedRentalId])

  const statusMutation = useMutation({
    mutationFn: (params: { rentalId: string; status: "active" | "returned" | "cancelled" }) =>
      updateVendorRentalStatus(params.rentalId, params.status),
    onSuccess: () => {
      toast.success("Rental status updated successfully")
      refresh()
      setDrawerOpen(false)
      setSelectedRental(null)
    },
    onError: (error: Error) => {
      toast.error(`Failed to update rental status: ${error.message}`)
    },
  })

  const depositMutation = useMutation({
    mutationFn: (params: {
      rentalId: string
      status: "refunded" | "partially_refunded" | "forfeited"
    }) => updateVendorRentalDeposit(params.rentalId, params.status),
    onSuccess: () => {
      toast.success("Security deposit updated successfully")
      refresh()
    },
    onError: (error: Error) => {
      toast.error(`Failed to update security deposit: ${error.message}`)
    },
  })

  const handleOpenDrawer = (rental: VendorRental) => {
    setSelectedRental(rental)
    setNewStatus(rental.status)
    setDrawerOpen(true)
  }

  const handleSubmit = () => {
    if (!selectedRental) {
      return
    }

    statusMutation.mutate({
      rentalId: selectedRental.id,
      status: newStatus as "active" | "returned" | "cancelled",
    })
  }

  if (!rentals.length) {
    return null
  }

  return (
    <>
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h2">Rental Items</Heading>
        </div>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Product</Table.HeaderCell>
              <Table.HeaderCell>Start Date</Table.HeaderCell>
              <Table.HeaderCell>End Date</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Deposit</Table.HeaderCell>
              <Table.HeaderCell>Actions</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {rentals.map((rental) => (
              <Table.Row key={rental.id}>
                <Table.Cell className="py-4">
                  <div className="flex items-start gap-4">
                    {rental.product_variant?.product?.thumbnail && (
                      <img
                        src={rental.product_variant.product.thumbnail}
                        alt={rental.product_variant.product.title || ""}
                        className="w-6 h-8 object-cover rounded border border-ui-border-base"
                      />
                    )}
                    <div>
                      <Text weight="plus" size="small" className="text-ui-fg-base">
                        {rental.product_variant?.product?.title || "N/A"}
                      </Text>
                      <Text size="xsmall" className="text-ui-fg-subtle">
                        {rental.product_variant?.title || "N/A"}
                      </Text>
                    </div>
                  </div>
                </Table.Cell>
                <Table.Cell>{formatDate(rental.rental_start_date)}</Table.Cell>
                <Table.Cell>{formatDate(rental.rental_end_date)}</Table.Cell>
                <Table.Cell>
                  <Badge color={getStatusBadgeColor(rental.status)} size="2xsmall">
                    {formatStatus(rental.status)}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  {rental.security_deposit_status ? (
                    <Badge
                      color={getDepositBadgeColor(rental.security_deposit_status)}
                      size="2xsmall"
                    >
                      {formatStatus(rental.security_deposit_status)}
                    </Badge>
                  ) : (
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      None
                    </Text>
                  )}
                </Table.Cell>
                <Table.Cell>
                  <Button
                    size="small"
                    variant="transparent"
                    onClick={() => handleOpenDrawer(rental)}
                    className="p-0 text-ui-fg-subtle"
                  >
                    Manage
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </Container>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Update Rental Status</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="space-y-4">
            {selectedRental && (
              <>
                <div>
                  <Text weight="plus" className="mb-2">
                    Rental Details
                  </Text>
                  <div className="space-y-1">
                    <Text size="small">
                      Product: {selectedRental.product_variant?.product?.title || "N/A"}
                    </Text>
                    <Text size="small">
                      Variant: {selectedRental.product_variant?.title || "N/A"}
                    </Text>
                    <Text size="small">
                      Rental Period: {formatDate(selectedRental.rental_start_date)} to{" "}
                      {formatDate(selectedRental.rental_end_date)}
                      {selectedRental.rental_units_count != null
                        ? ` (${selectedRental.rental_units_count} ${UNIT_NOUN_PLURAL[selectedRental.rental_unit ?? "day"]})`
                        : ` (${selectedRental.rental_days} days)`}
                    </Text>
                    {(selectedRental.pickup_time || selectedRental.return_time) && (
                      <Text size="small">
                        Pickup/Return time: {selectedRental.pickup_time ?? "—"} /{" "}
                        {selectedRental.return_time ?? "—"}
                      </Text>
                    )}
                  </div>
                </div>
                <hr />
                <div className="space-y-1">
                  <Label htmlFor="status" className="txt-compact-small font-medium">
                    Status
                  </Label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <Select.Trigger id="status">
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="pending" disabled className="text-ui-fg-disabled">
                        Pending
                      </Select.Item>
                      <Select.Item value="active">Active</Select.Item>
                      <Select.Item value="returned">Returned</Select.Item>
                      <Select.Item value="cancelled">Cancelled</Select.Item>
                    </Select.Content>
                  </Select>
                </div>

                {selectedRental.security_deposit_status && (
                  <>
                    <hr />
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="txt-compact-small font-medium">
                          Security Deposit
                        </Label>
                        <Badge
                          color={getDepositBadgeColor(selectedRental.security_deposit_status)}
                          size="2xsmall"
                        >
                          {formatStatus(selectedRental.security_deposit_status)}
                        </Badge>
                      </div>
                      <Text size="small" className="text-ui-fg-subtle">
                        {selectedRental.security_deposit_amount.toFixed(2)} held
                      </Text>
                      {selectedRental.security_deposit_status === "held" && (
                        <div className="flex gap-2">
                          <Button
                            size="small"
                            variant="secondary"
                            disabled={depositMutation.isPending}
                            onClick={() =>
                              depositMutation.mutate({
                                rentalId: selectedRental.id,
                                status: "refunded",
                              })
                            }
                          >
                            Mark Refunded
                          </Button>
                          <Button
                            size="small"
                            variant="secondary"
                            disabled={depositMutation.isPending}
                            onClick={() =>
                              depositMutation.mutate({
                                rentalId: selectedRental.id,
                                status: "partially_refunded",
                              })
                            }
                          >
                            Partially Refund
                          </Button>
                          <Button
                            size="small"
                            variant="danger"
                            disabled={depositMutation.isPending}
                            onClick={() =>
                              depositMutation.mutate({
                                rentalId: selectedRental.id,
                                status: "forfeited",
                              })
                            }
                          >
                            Forfeit
                          </Button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </Drawer.Body>
          <Drawer.Footer>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={statusMutation.isPending || newStatus === selectedRental?.status}
                isLoading={statusMutation.isPending}
              >
                Save
              </Button>
            </div>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </>
  )
}
