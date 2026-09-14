"use client"

import {
  deleteVendorInventoryItem,
  listVendorInventoryItems,
  type VendorInventoryItem,
  type VendorInventoryLevel,
} from "@lib/data/vendor-client"
import {
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { PlaceholderCell } from "@modules/common"
import { InventoryExportButton } from "./inventory-export-button"
import { EditItemDrawer } from "./forms/edit-item-drawer"
import { ManageLocationsDrawer } from "./forms/manage-locations-drawer"
import { AdjustStockDrawer } from "./forms/adjust-stock-drawer"
import { BulkStockModal } from "./forms/bulk-stock-modal"

const columnHelper = createDataTableColumnHelper<VendorInventoryItem>()
const filterHelper = createDataTableFilterHelper<VendorInventoryItem>()
const commandHelper = createDataTableCommandHelper()

const filters = [
  filterHelper.accessor("origin_country", {
    label: "Country of Origin",
    type: "select",
    options: [
      { label: "United States (US)", value: "US" },
      { label: "United Kingdom (GB)", value: "GB" },
      { label: "Germany (DE)", value: "DE" },
      { label: "India (IN)", value: "IN" },
      { label: "China (CN)", value: "CN" },
    ],
  }),
]

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

  const originCountry = filtering.origin_country as string | undefined

  const order = sorting
    ? (sorting.desc ? "-" : "") + sorting.id
    : undefined

  const { data, isLoading } = useQuery({
    queryKey: [
      "vendor-inventory-items",
      limit,
      offset,
      search,
      originCountry,
      order,
    ],
    queryFn: () =>
      listVendorInventoryItems({
        limit,
        offset,
        q: search || undefined,
        origin_country: originCountry,
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
    const confirmed = await prompt({
      title: "Delete inventory item",
      description: `Are you sure you want to delete "${item.title || item.sku}"? This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
    })

    if (!confirmed) return

    try {
      await remove(item.id)
      toast.success(`"${item.title || item.sku}" was deleted.`)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete the inventory item."
      )
    }
  }

  const items = data?.inventory_items ?? []
  const totalCount = data?.count ?? 0

  // Calculate summary metrics
  const totalStocked = items.reduce(
    (acc, curr) => acc + Number(curr.stocked_quantity ?? 0),
    0
  )
  const totalReserved = items.reduce(
    (acc, curr) => acc + Number(curr.reserved_quantity ?? 0),
    0
  )
  const outOfStockCount = items.filter(
    (item) => Number(item.stocked_quantity ?? 0) === 0
  ).length

  const columns = [
    columnHelper.accessor("title", {
      id: "title",
      header: "Title",
      enableSorting: true,
      sortLabel: "Title",
      sortAscLabel: "A-Z",
      sortDescLabel: "Z-A",
      cell: ({ row }) => {
        const title = row.original.title
        const sku = row.original.sku
        return (
          <div className="flex flex-col py-1">
            <span className="text-ui-fg-base txt-compact-small-plus truncate font-medium">
              {title || "Untitled Item"}
            </span>
            {sku && (
              <span className="text-ui-fg-subtle txt-compact-xsmall font-mono">
                {sku}
              </span>
            )}
          </div>
        )
      },
    }),
    columnHelper.accessor("sku", {
      id: "sku",
      header: "SKU",
      enableSorting: true,
      sortLabel: "SKU",
      cell: ({ row }) =>
        row.original.sku ? (
          <span className="bg-ui-bg-subtle text-ui-fg-subtle txt-compact-xsmall rounded px-2 py-0.5 font-mono">
            {row.original.sku}
          </span>
        ) : (
          <PlaceholderCell />
        ),
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
        return (
          <span className="text-ui-fg-subtle txt-compact-small font-medium">
            {count}
          </span>
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
        const reserved = item.location_levels?.length
          ? item.location_levels.reduce(
              (sum, lvl) => sum + Number(lvl.reserved_quantity ?? 0),
              0
            )
          : Number(item.reserved_quantity ?? 0)
        const available = stocked - reserved

        return (
          <div className="flex items-center gap-x-2">
            <span
              className={`txt-compact-small-plus rounded-md px-2 py-0.5 ${
                stocked === 0
                  ? "bg-ui-tag-red-bg text-ui-tag-red-text"
                  : available <= 5
                  ? "bg-ui-tag-orange-bg text-ui-tag-orange-text"
                  : "bg-ui-tag-green-bg text-ui-tag-green-text"
              }`}
            >
              {stocked} in stock
            </span>
            <span className="text-ui-fg-muted txt-compact-xsmall">
              ({available} available)
            </span>
          </div>
        )
      },
    }),
    columnHelper.action({
      actions: [
        {
          label: "View details",
          onClick: (ctx) => {
            router.push(`/inventory/${ctx.row.original.id}`)
          },
        },
        {
          label: "Edit general info",
          onClick: (ctx) => {
            setEditingItem(ctx.row.original)
          },
        },
        {
          label: "Manage locations",
          onClick: (ctx) => {
            setManagingLocationsItem(ctx.row.original)
          },
        },
        {
          label: "Adjust stock",
          onClick: (ctx) => {
            const firstLevel = ctx.row.original.location_levels?.[0] ?? null
            setAdjustingStockItem(ctx.row.original)
            setAdjustingLevel(firstLevel)
          },
        },
        {
          label: "Delete",
          onClick: (ctx) => handleDelete(ctx.row.original),
        },
      ],
    }),
  ]

  const commands = [
    commandHelper.command({
      label: "Adjust Stock",
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
          title: "Delete inventory items",
          description: `Delete ${ids.length} ${
            ids.length === 1 ? "inventory item" : "inventory items"
          }? This cannot be undone.`,
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
    <div className="flex flex-col gap-y-4">
      {/* Metric Cards Banner */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="bg-ui-bg-base shadow-elevation-card-rest border-ui-border-base rounded-lg border p-4">
          <Text size="xsmall" className="text-ui-fg-subtle uppercase">
            Total Items
          </Text>
          <Heading level="h3" className="mt-1">
            {totalCount}
          </Heading>
        </div>
        <div className="bg-ui-bg-base shadow-elevation-card-rest border-ui-border-base rounded-lg border p-4">
          <Text size="xsmall" className="text-ui-fg-subtle uppercase">
            In Stock Units
          </Text>
          <Heading level="h3" className="mt-1 text-ui-fg-interactive">
            {totalStocked}
          </Heading>
        </div>
        <div className="bg-ui-bg-base shadow-elevation-card-rest border-ui-border-base rounded-lg border p-4">
          <Text size="xsmall" className="text-ui-fg-subtle uppercase">
            Reserved Units
          </Text>
          <Heading level="h3" className="mt-1 text-ui-fg-muted">
            {totalReserved}
          </Heading>
        </div>
        <div className="bg-ui-bg-base shadow-elevation-card-rest border-ui-border-base rounded-lg border p-4">
          <Text size="xsmall" className="text-ui-fg-subtle uppercase">
            Out of Stock
          </Text>
          <Heading
            level="h3"
            className={`mt-1 ${
              outOfStockCount > 0 ? "text-ui-fg-error" : "text-ui-fg-subtle"
            }`}
          >
            {outOfStockCount}
          </Heading>
        </div>
      </div>

      <DataTable instance={table}>
        <DataTable.Toolbar className="flex items-center justify-between px-6 py-4">
          <div>
            <Heading level="h2">Inventory Items</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Manage stock levels, warehouses, and reservations.
            </Text>
          </div>
          <div className="flex items-center gap-x-2">
            <DataTable.Search placeholder="Search inventory..." />
            <DataTable.FilterMenu tooltip="Filter" />
            <DataTable.SortingMenu tooltip="Sort" />
            <InventoryExportButton />
            <Link
              href="/inventory/new"
              className="bg-ui-button-inverted text-ui-contrast-fg-primary shadow-buttons-inverted txt-compact-small-plus rounded-md px-3 py-1.5 transition-colors"
            >
              Create Item
            </Link>
          </div>
        </DataTable.Toolbar>
        <DataTable.FilterBar />
        <DataTable.Table
          emptyState={{
            empty: {
              heading: "No inventory items yet",
              description:
                "Create your first inventory item or attach one to a product variant.",
            },
            filtered: {
              heading: "No matches found",
              description: "No inventory items match that search or filter.",
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
    </div>
  )
}
