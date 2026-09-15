"use client"

import {
  deleteVendorCustomer,
  type VendorCustomer,
} from "@lib/data/vendor-client"
import {
  AccountCell,
  ActionMenu,
} from "@modules/common"
import { Container, Heading, Text, toast, usePrompt } from "@medusajs/ui"
import { PencilSquare, Trash } from "@medusajs/icons"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { CustomerDrawer } from "../forms/customer-drawer"

type CustomerGeneralSectionProps = {
  customer: VendorCustomer
}

export const GeneralSection = ({ customer }: CustomerGeneralSectionProps) => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const [isEditOpen, setIsEditOpen] = useState(false)

  const name = [customer.first_name, customer.last_name]
    .filter(Boolean)
    .join(" ")

  const deleteMutation = useMutation({
    mutationFn: () => deleteVendorCustomer(customer.id),
    onSuccess: () => {
      toast.success(`Customer ${customer.email} was successfully deleted.`)
      queryClient.invalidateQueries({ queryKey: ["vendor-customers"] })
      router.push("/customers")
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete customer")
    },
  })

  const handleDelete = async () => {
    const res = await prompt({
      title: "Delete Customer",
      description: `You are about to delete the customer ${customer.email}. This action cannot be undone.`,
      verificationInstruction: "Type to confirm",
      verificationText: customer.email,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
    })

    if (!res) {
      return
    }

    deleteMutation.mutate()
  }

  return (
    <>
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h1">{customer.email}</Heading>
          <div className="flex items-center gap-x-2">
            <AccountCell hasAccount={customer.has_account} />
            <ActionMenu
              groups={[
                {
                  actions: [
                    {
                      label: "Edit",
                      icon: <PencilSquare className="h-4 w-4" />,
                      onClick: () => setIsEditOpen(true),
                    },
                    {
                      label: "Delete",
                      icon: <Trash className="h-4 w-4" />,
                      onClick: handleDelete,
                    },
                  ],
                },
              ]}
            />
          </div>
        </div>

        <div className="text-ui-fg-subtle grid grid-cols-2 items-center px-6 py-4">
          <Text size="small" leading="compact" weight="plus">
            Name
          </Text>
          <Text size="small" leading="compact">
            {name || "-"}
          </Text>
        </div>

        <div className="text-ui-fg-subtle grid grid-cols-2 items-center px-6 py-4">
          <Text size="small" leading="compact" weight="plus">
            Company
          </Text>
          <Text size="small" leading="compact">
            {customer.company_name || "-"}
          </Text>
        </div>

        <div className="text-ui-fg-subtle grid grid-cols-2 items-center px-6 py-4">
          <Text size="small" leading="compact" weight="plus">
            Phone
          </Text>
          <Text size="small" leading="compact">
            {customer.phone || "-"}
          </Text>
        </div>
      </Container>

      <CustomerDrawer
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        customer={customer}
      />
    </>
  )
}
