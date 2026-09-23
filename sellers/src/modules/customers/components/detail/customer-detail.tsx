"use client"

import {
  getVendorCustomer,
} from "@lib/data/vendor-client"
import { ArrowLeft } from "@medusajs/icons"
import { Button, Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { AddressesSection } from "./addresses-section"
import { GeneralSection } from "./general-section"
import { GroupsSection } from "./groups-section"
import { MetadataSection } from "./metadata-section"
import { OrdersSection } from "./orders-section"

type CustomerDetailProps = {
  id: string
}

export const CustomerDetail = ({ id }: CustomerDetailProps) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["vendor-customer", id],
    queryFn: () => getVendorCustomer(id),
  })

  const customer = data?.customer

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Text size="small" className="text-ui-fg-subtle">
          Loading customer...
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

  return (
    <div className="flex flex-col gap-y-3">
      {/* 2-Column Layout matching Medusa Admin */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-4 gap-y-3">
        {/* Main Section */}
        <div className="lg:col-span-2 flex flex-col gap-y-3">
          <GeneralSection customer={customer} />
          <OrdersSection customer={customer} />
          <GroupsSection customer={customer} />
          <MetadataSection metadata={customer.metadata} />
        </div>

        {/* Side Section */}
        <div className="flex flex-col gap-y-3">
          <AddressesSection customer={customer} />
        </div>
      </div>
    </div>
  )
}
