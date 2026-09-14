"use client"

import {
  deleteVendorCustomerAddress,
  type VendorCustomer,
  type VendorCustomerAddress,
} from "@lib/data/vendor-client"
import { ActionMenu } from "@modules/common"
import { Badge, Button, Container, Heading, Text, toast, usePrompt } from "@medusajs/ui"
import { PencilSquare, Plus, Trash } from "@medusajs/icons"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { AddressDrawer } from "../forms/address-drawer"

type AddressesSectionProps = {
  customer: VendorCustomer
}

export const AddressesSection = ({ customer }: AddressesSectionProps) => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingAddress, setEditingAddress] =
    useState<VendorCustomerAddress | null>(null)

  const addresses = customer.addresses ?? []

  const deleteMutation = useMutation({
    mutationFn: (addressId: string) =>
      deleteVendorCustomerAddress(customer.id, addressId),
    onSuccess: () => {
      toast.success("Address deleted successfully")
      queryClient.invalidateQueries({
        queryKey: ["vendor-customer", customer.id],
      })
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete address")
    },
  })

  const handleDelete = async (address: VendorCustomerAddress) => {
    const confirmed = await prompt({
      title: "Delete Address",
      description: `Are you sure you want to delete this address (${address.address_1})?`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
    })

    if (confirmed) {
      deleteMutation.mutate(address.id)
    }
  }

  return (
    <>
      <Container className="p-6">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <Heading level="h2">Addresses</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Shipping and billing addresses saved for this customer.
            </Text>
          </div>

          <Button
            variant="secondary"
            size="small"
            onClick={() => setIsAddOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Address
          </Button>
        </div>

        {addresses.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Text size="small" className="text-ui-fg-subtle">
              No addresses saved for this customer yet.
            </Text>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            {addresses.map((addr) => {
              const name =
                [addr.first_name, addr.last_name].filter(Boolean).join(" ") ||
                addr.company
              const lines = [
                addr.address_1,
                addr.address_2,
                [addr.city, addr.province, addr.postal_code]
                  .filter(Boolean)
                  .join(", "),
                addr.country_code?.toUpperCase(),
              ].filter(Boolean)

              return (
                <div
                  key={addr.id}
                  className="border rounded-lg p-4 bg-ui-bg-subtle flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        {addr.address_name && (
                          <Badge size="small" color="blue" className="mb-1">
                            {addr.address_name}
                          </Badge>
                        )}
                        {name && (
                          <Text size="small" weight="plus">
                            {name}
                          </Text>
                        )}
                      </div>

                      <ActionMenu
                        groups={[
                          {
                            actions: [
                              {
                                label: "Edit",
                                icon: <PencilSquare className="h-4 w-4" />,
                                onClick: () => setEditingAddress(addr),
                              },
                              {
                                label: "Delete",
                                icon: <Trash className="h-4 w-4" />,
                                onClick: () => handleDelete(addr),
                              },
                            ],
                          },
                        ]}
                      />
                    </div>

                    <div className="flex flex-col gap-y-0.5 mt-2">
                      {lines.map((line, idx) => (
                        <Text
                          key={idx}
                          size="small"
                          className="text-ui-fg-subtle text-xs"
                        >
                          {line}
                        </Text>
                      ))}
                      {addr.phone && (
                        <Text size="xsmall" className="text-ui-fg-muted mt-1">
                          Phone: {addr.phone}
                        </Text>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Container>

      <AddressDrawer
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        customerId={customer.id}
      />

      <AddressDrawer
        open={Boolean(editingAddress)}
        onOpenChange={(open) => {
          if (!open) setEditingAddress(null)
        }}
        customerId={customer.id}
        address={editingAddress}
      />
    </>
  )
}
