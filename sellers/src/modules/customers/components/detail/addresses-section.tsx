"use client"

import {
  deleteVendorCustomerAddress,
  type VendorCustomer,
  type VendorCustomerAddress,
} from "@lib/data/vendor-client"
import { ActionMenu } from "@modules/common"
import {
  Button,
  Container,
  Heading,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { PencilSquare, Trash } from "@medusajs/icons"
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
      toast.success("Address was successfully deleted.")
      queryClient.invalidateQueries({
        queryKey: ["vendor-customer", customer.id],
      })
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete address")
    },
  })

  const handleDelete = async (address: VendorCustomerAddress) => {
    const name = address.address_name ?? "address"
    const confirmed = await prompt({
      title: "Are you sure?",
      description: `Are you sure you want to delete address "${name}"?`,
      verificationInstruction: "Type to confirm",
      verificationText: name,
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
      <Container className="p-0 divide-y">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h2">Addresses</Heading>
          <Button
            variant="secondary"
            size="small"
            onClick={() => setIsAddOpen(true)}
          >
            Add
          </Button>
        </div>

        {addresses.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Text size="small" weight="plus">
              No records
            </Text>
            <Text size="small" className="text-ui-fg-subtle mt-1">
              There are no addresses to display.
            </Text>
          </div>
        ) : (
          <div className="flex flex-col divide-y">
            {addresses.map((address) => {
              const lines = [
                address.address_1,
                address.address_2,
                [address.city, address.province, address.postal_code]
                  .filter(Boolean)
                  .join(" "),
                address.country_code?.toUpperCase(),
              ]
                .filter(Boolean)
                .join(", ")

              return (
                <div
                  key={address.id}
                  className="flex items-center justify-between px-6 py-4 hover:bg-ui-bg-base-hover transition-colors"
                >
                  <div className="flex flex-col gap-y-0.5">
                    <Text size="small" weight="plus">
                      {address.address_name ?? "n/a"}
                    </Text>
                    <Text size="small" className="text-ui-fg-subtle">
                      {lines || "-"}
                    </Text>
                  </div>

                  <ActionMenu
                    groups={[
                      {
                        actions: [
                          {
                            label: "Edit",
                            icon: <PencilSquare className="h-4 w-4" />,
                            onClick: () => setEditingAddress(address),
                          },
                          {
                            label: "Delete",
                            icon: <Trash className="h-4 w-4" />,
                            onClick: () => handleDelete(address),
                          },
                        ],
                      },
                    ]}
                  />
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
