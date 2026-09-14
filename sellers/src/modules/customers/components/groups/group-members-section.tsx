"use client"

import {
  batchVendorCustomerGroupMembers,
  type VendorCustomer,
  type VendorCustomerGroup,
} from "@lib/data/vendor-client"
import { ActionMenu, PlaceholderCell } from "@modules/common"
import {
  Avatar,
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Table,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { MagnifyingGlass, Plus, Trash } from "@medusajs/icons"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useState } from "react"
import { AddCustomersModal } from "./add-customers-modal"

type GroupMembersSectionProps = {
  group: VendorCustomerGroup
}

export const GroupMembersSection = ({ group }: GroupMembersSectionProps) => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [search, setSearch] = useState("")

  const members = group.customers ?? []
  const memberIds = members.map((m) => m.id)

  const filteredMembers = members.filter((m) => {
    if (!search.trim()) return true
    const term = search.toLowerCase().trim()
    const name = [m.first_name, m.last_name].filter(Boolean).join(" ").toLowerCase()
    const email = (m.email || "").toLowerCase()
    const phone = (m.phone || "").toLowerCase()
    return name.includes(term) || email.includes(term) || phone.includes(term)
  })

  const removeMutation = useMutation({
    mutationFn: (customerId: string) =>
      batchVendorCustomerGroupMembers(group.id, { remove: [customerId] }),
    onSuccess: () => {
      toast.success("Customer removed from group")
      queryClient.invalidateQueries({
        queryKey: ["vendor-customer-group", group.id],
      })
      queryClient.invalidateQueries({ queryKey: ["vendor-customer-groups"] })
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to remove customer")
    },
  })

  const handleRemove = async (customer: VendorCustomer) => {
    const customerName =
      [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
      customer.email

    const confirmed = await prompt({
      title: "Remove Member",
      description: `Are you sure you want to remove "${customerName}" from ${group.name}?`,
      confirmText: "Remove",
      cancelText: "Cancel",
      variant: "danger",
    })

    if (confirmed) {
      removeMutation.mutate(customer.id)
    }
  }

  return (
    <>
      <Container className="p-0 overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <Heading level="h2">Customers ({members.length})</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Customers assigned to this group.
            </Text>
          </div>

          <Button
            variant="secondary"
            size="small"
            onClick={() => setIsAddOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Customers
          </Button>
        </div>

        {members.length > 0 && (
          <div className="p-4 border-b bg-ui-bg-subtle/50">
            <div className="relative max-w-sm">
              <MagnifyingGlass className="absolute left-3 top-2.5 h-4 w-4 text-ui-fg-muted" />
              <Input
                placeholder="Search group members..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        )}

        {filteredMembers.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Text size="small" className="text-ui-fg-subtle">
              {search
                ? "No matching group members found."
                : "No customers in this group yet."}
            </Text>
          </div>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Customer</Table.HeaderCell>
                <Table.HeaderCell>Phone</Table.HeaderCell>
                <Table.HeaderCell>Company</Table.HeaderCell>
                <Table.HeaderCell>Account</Table.HeaderCell>
                <Table.HeaderCell className="w-12"></Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {filteredMembers.map((customer) => {
                const fullName =
                  [customer.first_name, customer.last_name]
                    .filter(Boolean)
                    .join(" ") || "Unnamed"
                const fallback = (
                  customer.first_name?.[0] ||
                  customer.email?.[0] ||
                  "C"
                ).toUpperCase()

                return (
                  <Table.Row key={customer.id}>
                    <Table.Cell>
                      <Link
                        href={`/customers/${customer.id}`}
                        className="flex items-center gap-x-3 group"
                      >
                        <Avatar fallback={fallback} size="small" />
                        <div className="flex flex-col">
                          <Text
                            size="small"
                            weight="plus"
                            className="group-hover:text-ui-fg-interactive transition-colors"
                          >
                            {fullName}
                          </Text>
                          <Text size="xsmall" className="text-ui-fg-subtle">
                            {customer.email}
                          </Text>
                        </div>
                      </Link>
                    </Table.Cell>
                    <Table.Cell>
                      {customer.phone ? (
                        <Text size="small">{customer.phone}</Text>
                      ) : (
                        <PlaceholderCell />
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {customer.company_name ? (
                        <Text size="small">{customer.company_name}</Text>
                      ) : (
                        <PlaceholderCell />
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <Badge
                        size="small"
                        color={customer.has_account ? "green" : "grey"}
                      >
                        {customer.has_account ? "Registered" : "Guest"}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <ActionMenu
                        groups={[
                          {
                            actions: [
                              {
                                label: "Remove from Group",
                                icon: <Trash className="h-4 w-4" />,
                                onClick: () => handleRemove(customer),
                              },
                            ],
                          },
                        ]}
                      />
                    </Table.Cell>
                  </Table.Row>
                )
              })}
            </Table.Body>
          </Table>
        )}
      </Container>

      <AddCustomersModal
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        groupId={group.id}
        existingMemberIds={memberIds}
      />
    </>
  )
}
