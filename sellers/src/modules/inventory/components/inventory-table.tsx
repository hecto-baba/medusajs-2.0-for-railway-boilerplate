"use client"

import {
  deleteVendorInventoryItem,
  listVendorInventoryItems,
  type VendorInventoryItem,
  type VendorInventoryLevel,
} from "@lib/data/vendor-client"
import {
  Button,
  Checkbox,
  Container,
  createDataTableColumnHelper,
  createDataTableCommandHelper,
  createDataTableFilterHelper,
  DataTable,
  DataTableFilteringState,
  DataTablePaginationState,
  DataTableRowSelectionState,
  DataTableSortingState,
  Heading,
  Text,
  toast,
  useDataTable,
  usePrompt,
} from "@medusajs/ui"
import { PencilSquare, Trash } from "@medusajs/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { PlaceholderCell } from "@modules/common"
import { InventoryExportButton } from "./inventory-export-button"
import { EditItemDrawer } from "./forms/edit-item-drawer"
import { ManageLocationsDrawer } from "./forms/manage-locations-drawer"
import { AdjustStockDrawer } from "./forms/adjust-stock-drawer"
import { BulkStockModal } from "./forms/bulk-stock-modal"

const columnHelper = createDataTableColumnHelper<VendorInventoryItem>()
const filterHelper = createDataTableFilterHelper<VendorInventoryItem>()
const commandHelper = createDataTableCommandHelper()

export const InventoryTable = () => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [search, setSearch] = useState("")
  const [filtering, setFiltering] = useState<DataTableFilteringState>({})
  const [rowSelection, setRowSelection] = useState<DataTableRowSelectionState>(
    {}
  )
  const [sorting, setSorting] = useState<DataTableSortingState | null>(null)
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  // Drawers state
  const [editingItem, setEditingItem] = useState<VendorInventoryItem | null>(null)
  const [managingLocationsItem, setManagingLocationsItem] =
    useState<VendorInventoryItem | null>(null)
  const [adjustingStockItem, setAdjustingStockItem] =
    useState<VendorInventoryItem | null>(null)
  const [adjustingLevel, setAdjustingLevel] =
    useState<VendorInventoryLevel | null>(null)
  const [bulkAdjustOpen, setBulkAdjustOpen] = useState(false)

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const order = sorting
    ? (sorting.desc ? "-" : "") + sorting.id
    : undefined

  const { data, isLoading } = useQuery({
    queryKey: [
      "vendor-inventory-items",
      limit,
      offset,
      search,
      order,
    ],
    queryFn: () =>
      listVendorInventoryItems({
        limit,
        offset,
        q: search || undefined,
        order,
      }),
    placeholderData: (previous) => previous,
  })

  const { mutateAsync: remove } = useMutation({
    mutationFn: (id: string) => deleteVendorInventoryItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-inventory-items"] })
    },
  })

  const handleDelete = async (item: VendorInventoryItem) => {
    const res = await prompt({
      title: "Are you sure?",
      description:
        "You are about to delete an inventory item. This action cannot be undone.",
      confirmText: "Delete",
      cancelText: "Cancel",
    })

    if (!res) return

    try {
      await remove(item.id)
      toast.success("Inventory item deleted successfully.")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete the inventory item."
      )
    }
  }

  const items = data?.inventory_items ?? []
  const totalCount = data?.count ?? 0

  const filters = useMemo(
    () => [
      filterHelper.accessor("requires_shipping", {
        type: "select",
        options: [
          { label: "True", value: "true" },
          { label: "False", value: "false" },
        ],
        label: "Requires shipping",
      }),
    ],
    []
  )

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
      columnHelper.accessor("title", {
        id: "title",
        header: "Title",
        enableSorting: true,
        sortLabel: "Title",
        cell: ({ row }) => {
          const title = row.original.title
          if (!title) {
            return <PlaceholderCell />
          }
          return (
            <div className="flex size-full items-center overflow-hidden">
              <span className="truncate">{title}</span>
            </div>
          )
        },
      }),
      columnHelper.accessor("sku", {
        id: "sku",
        header: "SKU",
        enableSorting: true,
        sortLabel: "SKU",
        cell: ({ row }) => {
          const sku = row.original.sku
          if (!sku) {
            return <PlaceholderCell />
          }
          return (
            <div className="flex size-full items-center overflow-hidden">
              <span className="truncate">{sku}</span>
            </div>
          )
        },
      }),
      columnHelper.accessor("reserved_quantity", {
        id: "reserved_quantity",
        header: "Reserved",
        enableSorting: true,
        sortLabel: "Reserved",
        cell: ({ row }) => {
          const item = row.original
          const count = item.location_levels?.length
            ? item.location_levels.reduce(
                (sum, lvl) => sum + Number(lvl.reserved_quantity ?? 0),
                0
              )
            : Number(item.reserved_quantity ?? 0)

          if (Number.isNaN(count)) {
            return <PlaceholderCell />
          }

          return (
            <div className="flex size-full items-center overflow-hidden">
              <span className="truncate">{count}</span>
            </div>
          )
        },
      }),
      columnHelper.accessor("stocked_quantity", {
        id: "stocked_quantity",
        header: "In Stock",
        enableSorting: true,
        sortLabel: "In Stock",
        cell: ({ row }) => {
          const item = row.original
          const stocked = item.location_levels?.length
            ? item.location_levels.reduce(
                (sum, lvl) => sum + Number(lvl.stocked_quantity ?? 0),
                0
              )
            : Number(item.stocked_quantity ?? 0)

          if (Number.isNaN(stocked)) {
            return <PlaceholderCell />
          }

          return (
            <div className="flex size-full items-center overflow-hidden">
              <span className="truncate">{stocked}</span>
            </div>
          )
        },
      }),
      columnHelper.action({
        actions: (ctx) => [
          [
            {
              icon: <PencilSquare />,
              label: "Edit",
              onClick: () => setEditingItem(ctx.row.original),
            },
          ],
          [
            {
              icon: <Trash />,
              label: "Delete",
              onClick: () => handleDelete(ctx.row.original),
            },
          ],
        ],
      }),
    ],
    [handleDelete]
  )

  const commands = [
    commandHelper.command({
      label: "Edit stock levels",
      shortcut: "i",
      action: async () => {
        setBulkAdjustOpen(true)
      },
    }),
    commandHelper.command({
      label: "Delete",
      shortcut: "d",
      action: async (selection) => {
        const ids = Object.keys(selection)
        const confirmed = await prompt({
          title: "Are you sure?",
          description: `You are about to delete ${ids.length} ${
            ids.length === 1 ? "inventory item" : "inventory items"
          }. This action cannot be undone.`,
          confirmText: "Delete",
          cancelText: "Cancel",
        })

        if (!confirmed) return

        const failures: string[] = []
        for (const id of ids) {
          try {
            await deleteVendorInventoryItem(id)
          } catch {
            failures.push(id)
          }
        }

        queryClient.invalidateQueries({ queryKey: ["vendor-inventory-items"] })
        setRowSelection({})

        if (failures.length) {
          toast.error(
            `${failures.length} of ${ids.length} could not be deleted.`
          )
          return
        }

        toast.success(
          `${ids.length} ${ids.length === 1 ? "item" : "items"} deleted.`
        )
      },
    }),
  ]

  const table = useDataTable({
    data: items,
    columns,
    getRowId: (item) => item.id,
    rowCount: totalCount,
    isLoading,
    onRowClick: (_event, row) => router.push(`/inventory/${row.id}`),
    search: {
      state: search,
      onSearchChange: (value) => {
        setSearch(value)
        setPagination((state) => ({ ...state, pageIndex: 0 }))
      },
    },
    filtering: {
      state: filtering,
      onFilteringChange: (value) => {
        setFiltering(value)
        setPagination((state) => ({ ...state, pageIndex: 0 }))
      },
    },
    filters,
    commands,
    rowSelection: {
      state: rowSelection,
      onRowSelectionChange: setRowSelection,
    },
    sorting: {
      state: sorting,
      onSortingChange: setSorting,
    },
    pagination: {
      state: pagination,
      onPaginationChange: setPagination,
    },
  })

  // Selected items array for bulk actions
  const selectedItems = items.filter((item) => !!rowSelection[item.id])

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading>Inventory</Heading>
          <Text className="text-ui-fg-subtle" size="small">
            Manage your inventory items
          </Text>
        </div>
        <div className="flex items-center justify-center gap-x-2">
          <InventoryExportButton />
          <Button size="small" variant="secondary" asChild>
            <Link href="/inventory/new">Create</Link>
          </Button>
        </div>
      </div>

      <DataTable instance={table}>
        <DataTable.Toolbar className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-x-2">
            <DataTable.Search placeholder="Search" />
            <DataTable.FilterMenu tooltip="Filter" />
            <DataTable.SortingMenu tooltip="Sort" />
          </div>
        </DataTable.Toolbar>
        <DataTable.FilterBar />
        <DataTable.Table
          emptyState={{
            empty: {
              heading: "No records",
              description: "There are no records to show",
            },
            filtered: {
              heading: "No results",
              description: "Try changing the filters or search query",
            },
          }}
        />
        <DataTable.Pagination />
        <DataTable.CommandBar
          selectedLabel={(count) => `${count} selected`}
        />
      </DataTable>

      {/* Edit Drawer */}
      {editingItem && (
        <EditItemDrawer
          item={editingItem}
          open={!!editingItem}
          onOpenChange={(open) => !open && setEditingItem(null)}
        />
      )}

      {/* Manage Locations Drawer */}
      {managingLocationsItem && (
        <ManageLocationsDrawer
          item={managingLocationsItem}
          open={!!managingLocationsItem}
          onOpenChange={(open) => !open && setManagingLocationsItem(null)}
        />
      )}

      {/* Adjust Stock Drawer */}
      {adjustingStockItem && adjustingLevel && (
        <AdjustStockDrawer
          item={adjustingStockItem}
          level={adjustingLevel}
          open={!!adjustingStockItem}
          onOpenChange={(open) => {
            if (!open) {
              setAdjustingStockItem(null)
              setAdjustingLevel(null)
            }
          }}
        />
      )}

      {/* Bulk Stock Adjust Modal */}
      {bulkAdjustOpen && selectedItems.length > 0 && (
        <BulkStockModal
          items={selectedItems}
          open={bulkAdjustOpen}
          onOpenChange={setBulkAdjustOpen}
        />
      )}
    </Container>
  )
}
