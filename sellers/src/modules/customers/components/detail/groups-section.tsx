"use client"

import { type VendorCustomer } from "@lib/data/vendor-client"
import { Badge, Container, Heading, Text } from "@medusajs/ui"
import Link from "next/link"

type GroupsSectionProps = {
  customer: VendorCustomer
}

export const GroupsSection = ({ customer }: GroupsSectionProps) => {
  const groups = customer.groups ?? []

  return (
    <Container className="p-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <Heading level="h2">Customer Groups</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Groups this customer belongs to.
          </Text>
        </div>
        <Badge size="small" color="blue">
          {groups.length} {groups.length === 1 ? "group" : "groups"}
        </Badge>
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <Text size="small" className="text-ui-fg-subtle">
            This customer is not a member of any customer groups yet.
          </Text>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 pt-4">
          {groups.map((group) => (
            <Link key={group.id} href={`/customers/groups/${group.id}`}>
              <Badge
                size="large"
                color="blue"
                className="hover:opacity-80 transition-opacity cursor-pointer"
              >
                {group.name}
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </Container>
  )
}
