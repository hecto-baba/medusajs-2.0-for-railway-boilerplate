"use client"

import { type VendorCustomer } from "@lib/data/vendor-client"
import { ActionMenu, SectionRow } from "@modules/common"
import { Avatar, Badge, Container, Heading, Text } from "@medusajs/ui"
import { PencilSquare } from "@medusajs/icons"
import { useState } from "react"
import { CustomerDrawer } from "../forms/customer-drawer"

type GeneralSectionProps = {
  customer: VendorCustomer
}

export const GeneralSection = ({ customer }: GeneralSectionProps) => {
  const [isEditOpen, setIsEditOpen] = useState(false)

  const fullName =
    [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
    "Unnamed Customer"
  const fallback = (
    customer.first_name?.[0] ||
    customer.email?.[0] ||
    "C"
  ).toUpperCase()

  return (
    <>
      <Container className="p-6">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-x-4">
            <Avatar fallback={fallback} size="large" />
            <div>
              <Heading level="h2">{fullName}</Heading>
              <Text size="small" className="text-ui-fg-subtle">
                {customer.email}
              </Text>
            </div>
          </div>

          <ActionMenu
            groups={[
              {
                actions: [
                  {
                    label: "Edit Details",
                    icon: <PencilSquare className="h-4 w-4" />,
                    onClick: () => setIsEditOpen(true),
                  },
                ],
              },
            ]}
          />
        </div>

        <div className="flex flex-col divide-y pt-2">
          <SectionRow
            title="Account Status"
            value={
              <Badge size="small" color={customer.has_account ? "green" : "grey"}>
                {customer.has_account ? "Registered User" : "Guest Customer"}
              </Badge>
            }
          />
          <SectionRow
            title="Phone Number"
            value={customer.phone || "-"}
          />
          <SectionRow
            title="Company Name"
            value={customer.company_name || "-"}
          />
          <SectionRow
            title="Orders Placed"
            value={`${customer.orders_count ?? customer.orders?.length ?? 0} orders`}
          />
          <SectionRow
            title="Customer Since"
            value={
              customer.created_at
                ? new Date(customer.created_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : "-"
            }
          />
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
