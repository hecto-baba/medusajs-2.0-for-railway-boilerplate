"use client"

import {
  listVendorCustomerGroups,
  type VendorCustomerGroup,
} from "@lib/data/vendor-client"
import {
  Button,
  Checkbox,
  createDataTableColumnHelper,
  DataTable,
  DataTablePaginationState,
  Heading,
  Text,
  useDataTable,
} from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"

export type CustomerGroupItem = {
  id: string
  name: string
}

type PriceListCustomerGroupRuleFormProps = {
  state: CustomerGroupItem[]
  setState: (state: CustomerGroupItem[]) => void
  onClose: () => void
}

const columnHelper = createDataTableColumnHelper<VendorCustomerGroup>()

export const PriceListCustomerGroupRuleForm = ({
  state,
  setState,
  onClose,
}: PriceListCustomerGroupRuleFormProps) => {
  const [search, setSearch] = useState("")
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  const [selectedGroups, setSelectedGroups] = useState<CustomerGroupItem[]>(state)

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-customer-groups", { limit, offset, q: search }],
    queryFn: () =>
      listVendorCustomerGroups({
        limit,
        offset,
        q: search || undefined,
      }),
  })

  const customerGroups = data?.customer_groups ?? []
  const count = data?.count ?? 0

  const toggleGroup = (group: VendorCustomerGroup) => {
    setSelectedGroups((prev) => {
      const exists = prev.some((g) => g.id === group.id)
      if (exists) {
        return prev.filter((g) => g.id !== group.id)
      } else {
        return [...prev, { id: group.id, name: group.name }]
      }
    })
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const newItems = customerGroups.map((g) => ({ id: g.id, name: g.name }))
      const combined = [...selectedGroups]
      for (const item of newItems) {
        if (!combined.some((g) => g.id === item.id)) {
          combined.push(item)
        }
      }
      setSelectedGroups(combined)
    } else {
      const pageIds = customerGroups.map((g) => g.id)
      setSelectedGroups((prev) => prev.filter((g) => !pageIds.includes(g.id)))
    }
  }

  const allPageSelected =
    customerGroups.length > 0 &&
    customerGroups.every((g) => selectedGroups.some((s) => s.id === g.id))

  const somePageSelected =
    customerGroups.some((g) => selectedGroups.some((s) => s.id === g.id)) &&
    !allPageSelected

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "select",
        header: () => (
          <Checkbox
            checked={
              allPageSelected
                ? true
                : somePageSelected
                ? "indeterminate"
                : false
            }
            onCheckedChange={(checked) => handleSelectAll(!!checked)}
          />
        ),
        cell: ({ row }) => {
          const group = row.original
          const isSelected = selectedGroups.some((g) => g.id === group.id)
          return (
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => toggleGroup(group)}
              onClick={(e) => e.stopPropagation()}
            />
          )
        },
      }),
      columnHelper.accessor("name", {
        header: "Name",
        cell: ({ getValue }) => (
          <Text size="small" weight="plus">
            {getValue()}
          </Text>
        ),
      }),
      columnHelper.accessor("customers_count", {
        header: "Members",
        cell: ({ getValue, row }) => {
          const members = getValue() ?? row.original.customers?.length ?? 0
          return (
            <Text size="small" className="text-ui-fg-subtle">
              {members} {members === 1 ? "customer" : "customers"}
            </Text>
          )
        },
      }),
      columnHelper.accessor("created_at", {
        header: "Created",
        cell: ({ getValue }) => {
          const date = getValue()
          return (
            <Text size="small" className="text-ui-fg-subtle">
              {date ? new Date(date).toLocaleDateString() : "-"}
            </Text>
          )
        },
      }),
    ],
    [selectedGroups, customerGroups, allPageSelected, somePageSelected]
  )

  const table = useDataTable({
    data: customerGroups,
    columns,
    rowCount: count,
    getRowId: (row) => row.id,
    isLoading,
    pagination: {
      state: pagination,
      onPaginationChange: setPagination,
    },
    search: {
      state: search,
      onSearchChange: setSearch,
    },
  })

  const handleSave = () => {
    setState(selectedGroups)
    onClose()
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-ui-bg-base">
      <div className="flex flex-1 flex-col overflow-hidden p-6">
        <DataTable instance={table}>
          <DataTable.Toolbar className="flex items-center justify-between">
            <DataTable.Search placeholder="Search customer groups..." />
          </DataTable.Toolbar>
          <DataTable.Table />
          <DataTable.Pagination />
        </DataTable>
      </div>

      <div className="flex items-center justify-end gap-x-2 border-t p-4 bg-ui-bg-base">
        <Button variant="secondary" size="small" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" size="small" onClick={handleSave}>
          Save
        </Button>
      </div>
    </div>
  )
}
