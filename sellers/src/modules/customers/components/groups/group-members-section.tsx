"use client"

import {
  batchVendorCustomerGroupMembers,
  type VendorCustomer,
  type VendorCustomerGroup,
} from "@lib/data/vendor-client"
import {
  Button,
  Checkbox,
  Container,
  createDataTableColumnHelper,
  createDataTableCommandHelper,
  DataTable,
  DataTablePaginationState,
  DataTableRowSelectionState,
  Heading,
  Text,
  toast,
  useDataTable,
  usePrompt,
} from "@medusajs/ui"
import { PencilSquare, Trash } from "@medusajs/icons"
import {
  AccountCell,
  AccountHeader,
  ActionMenu,
  DateCell,
  EmailCell,
  EmailHeader,
  FirstSeenHeader,
  NameCell,
  NameHeader,
} from "@modules/common"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useMemo, useState } from "react"
import { AddCustomersModal } from "./add-customers-modal"
import { CustomerDrawer } from "../forms/customer-drawer"

type GroupMembersSectionProps = {
  group: VendorCustomerGroup
}

const columnHelper = createDataTableColumnHelper<VendorCustomer>()
const commandHelper = createDataTableCommandHelper()

export const GroupMembersSection = ({ group }: GroupMembersSectionProps) => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<VendorCustomer | null>(
    null
  )
  const [search, setSearch] = useState("")
  const [rowSelection, setRowSelection] = useState<DataTableRowSelectionState>({})
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  const members = group.customers ?? []
  const memberIds = members.map((m) => m.id)

  const removeMutation = useMutation({
    mutationFn: (customerIds: string[]) =>
      batchVendorCustomerGroupMembers(group.id, { remove: customerIds }),
    onSuccess: () => {
      toast.success("Customer removed from group")
      queryClient.invalidateQueries({
        queryKey: ["vendor-customer-group", group.id],
      })
      queryClient.invalidateQueries({ queryKey: ["vendor-customer-groups"] })
      setRowSelection({})
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to remove customer")
    },
  })

  const handleRemoveSingle = async (customer: VendorCustomer) => {
    const res = await prompt({
      title: "Remove customer",
      description:
        "You are about to remove 1 customer from the customer group. This action cannot be undone.",
      confirmText: "Continue",
      cancelText: "Cancel",
    })

    if (res) {
      removeMutation.mutate([customer.id])
    }
  }

  const handleRemoveBatch = async () => {
    const selectedIds = Object.keys(rowSelection).filter(
      (k) => rowSelection[k]
    )

    if (selectedIds.length === 0) return

    const res = await prompt({
      title: "Remove customers",
      description: `You are about to remove ${selectedIds.length} customers from the customer group. This action cannot be undone.`,
      confirmText: "Continue",
      cancelText: "Cancel",
    })

    if (res) {
      removeMutation.mutate(selectedIds)
    }
  }

  const filteredMembers = useMemo(() => {
    if (!search.trim()) return members
    const term = search.toLowerCase().trim()
    return members.filter((m) => {
      const name = [m.first_name, m.last_name].filter(Boolean).join(" ").toLowerCase()
      const email = (m.email || "").toLowerCase()
      return name.includes(term) || email.includes(term)
    })
  }, [members, search])

  const count = filteredMembers.length
  const pagedMembers = useMemo(() => {
    const start = pagination.pageIndex * pagination.pageSize
    return filteredMembers.slice(start, start + pagination.pageSize)
  }, [filteredMembers, pagination])

  const columns = useMemo(
    () => [
      columnHelper.select({
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsSomePageRowsSelected()
                ? "indeterminate"
                : table.getIsAllPageRowsSelected()
            }
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            onClick={(e) => e.stopPropagation()}
          />
        ),
      }),
      columnHelper.accessor("email", {
        header: () => <EmailHeader />,
        cell: ({ getValue, row }) => (
          <Link
            href={`/customers/${row.original.id}`}
            className="text-ui-fg-base hover:text-ui-fg-interactive font-medium transition-colors"
          >
            <EmailCell email={getValue()} />
          </Link>
        ),
      }),
      columnHelper.display({
        id: "name",
        header: () => <NameHeader />,
        cell: ({
          row: {
            original: { first_name, last_name },
          },
        }) => <NameCell firstName={first_name} lastName={last_name} />,
      }),
      columnHelper.accessor("has_account", {
        header: () => <AccountHeader />,
        cell: ({ getValue }) => <AccountCell hasAccount={getValue()} />,
      }),
      columnHelper.accessor("created_at", {
        header: () => <FirstSeenHeader />,
        cell: ({ getValue }) => <DateCell date={getValue()} />,
      }),
      columnHelper.display({
        id: "actions",
        cell: ({ row }) => {
          const customer = row.original
          return (
            <ActionMenu
              groups={[
                {
                  actions: [
                    {
                      label: "Edit",
                      icon: <PencilSquare className="h-4 w-4" />,
                      onClick: () => setEditingCustomer(customer),
                    },
                    {
                      label: "Remove",
                      icon: <Trash className="h-4 w-4" />,
                      onClick: () => handleRemoveSingle(customer),
                    },
                  ],
                },
              ]}
            />
          )
        },
      }),
    ],
    []
  )

  const commands = useMemo(
    () => [
      commandHelper.command({
        label: "Remove",
        shortcut: "r",
        action: handleRemoveBatch,
      }),
    ],
    [rowSelection, members]
  )

  const table = useDataTable({
    data: pagedMembers,
    columns,
    rowCount: count,
    getRowId: (row) => row.id,
    commands,
    rowSelection: {
      state: rowSelection,
      onRowSelectionChange: setRowSelection,
    },
    pagination: {
      state: pagination,
      onPaginationChange: setPagination,
    },
    search: {
      state: search,
      onSearchChange: setSearch,
    },
  })

  return (
    <>
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h2">Customers</Heading>
          <Button
            variant="secondary"
            size="small"
            onClick={() => setIsAddOpen(true)}
          >
            Add
          </Button>
        </div>

        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Text size="small" className="text-ui-fg-subtle">
              This group doesn&apos;t have customers.
            </Text>
          </div>
        ) : (
          <DataTable instance={table}>
            <DataTable.Toolbar className="flex items-center justify-between">
              <DataTable.Search placeholder="Search customers..." />
            </DataTable.Toolbar>
            <DataTable.Table />
            <DataTable.Pagination />
            <DataTable.CommandBar />
          </DataTable>
        )}
      </Container>

      <AddCustomersModal
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        groupId={group.id}
        existingMemberIds={memberIds}
      />

      <CustomerDrawer
        open={Boolean(editingCustomer)}
        onOpenChange={(open) => {
          if (!open) setEditingCustomer(null)
        }}
        customer={editingCustomer}
      />
    </>
  )
}
