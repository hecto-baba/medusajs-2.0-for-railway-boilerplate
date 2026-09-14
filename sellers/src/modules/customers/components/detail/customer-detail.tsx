"use client"

import {
  deleteVendorCustomer,
  getVendorCustomer,
} from "@lib/data/vendor-client"
import { ActionMenu } from "@modules/common"
import { ArrowLeft, Trash } from "@medusajs/icons"
import { Button, Heading, Text, toast, usePrompt } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AddressesSection } from "./addresses-section"
import { GeneralSection } from "./general-section"
import { GroupsSection } from "./groups-section"
import { MetadataSection } from "./metadata-section"
import { OrdersSection } from "./orders-section"

type CustomerDetailProps = {
  id: string
}

export const CustomerDetail = ({ id }: CustomerDetailProps) => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const { data, isLoading, error } = useQuery({
    queryKey: ["vendor-customer", id],
    queryFn: () => getVendorCustomer(id),
  })

  const customer = data?.customer

  const deleteMutation = useMutation({
    mutationFn: (customerId: string) => deleteVendorCustomer(customerId),
    onSuccess: () => {
      toast.success("Customer removed successfully")
      queryClient.invalidateQueries({ queryKey: ["vendor-customers"] })
      router.push("/customers")
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to remove customer")
    },
  })

  const handleDelete = async () => {
    if (!customer) return

    const customerName =
      [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
      customer.email

    const confirmed = await prompt({
      title: "Remove Customer",
      description: `Are you sure you want to remove "${customerName}" from your store?`,
      confirmText: "Remove",
      cancelText: "Cancel",
      variant: "danger",
    })

    if (confirmed) {
      deleteMutation.mutate(customer.id)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Text size="small" className="text-ui-fg-subtle">
          Loading customer details...
        </Text>
      </div>
    )
  }

  if (error || !customer) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-y-4">
        <Text size="small" className="text-ui-fg-error">
          Customer not found or access denied.
        </Text>
        <Link href="/customers">
          <Button variant="secondary" size="small">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Customers
          </Button>
        </Link>
      </div>
    )
  }

  const fullName =
    [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
    customer.email

  return (
    <div className="flex flex-col gap-y-6 pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-x-3">
          <Link href="/customers">
            <Button variant="secondary" size="small">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-x-2">
              <Heading level="h1">{fullName}</Heading>
            </div>
            <Text size="xsmall" className="text-ui-fg-subtle font-mono">
              ID: {customer.id}
            </Text>
          </div>
        </div>

        <ActionMenu
          groups={[
            {
              actions: [
                {
                  label: "Remove Customer",
                  icon: <Trash className="h-4 w-4" />,
                  onClick: handleDelete,
                },
              ],
            },
          ]}
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-y-6">
          <GeneralSection customer={customer} />
          <OrdersSection customer={customer} />
          <AddressesSection customer={customer} />
        </div>

        <div className="flex flex-col gap-y-6">
          <GroupsSection customer={customer} />
          <MetadataSection metadata={customer.metadata} />
        </div>
      </div>
    </div>
  )
}
