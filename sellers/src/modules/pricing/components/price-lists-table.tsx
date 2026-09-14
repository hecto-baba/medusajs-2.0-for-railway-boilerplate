"use client"

import {
  deleteVendorPriceList,
  listVendorCustomerGroups,
  listVendorPriceLists,
  type VendorPriceList,
  type VendorPriceListStatus,
  type VendorPriceListType,
} from "@lib/data/vendor-client"
import { ActionMenu } from "@modules/common"
import {
  CurrencyDollar,
  Eye,
  PencilSquare,
  Plus,
  Trash,
} from "@medusajs/icons"
import {
  Badge,
  Button,
  createDataTableColumnHelper,
  createDataTableFilterHelper,
  DataTable,
  DataTableFilteringState,
  DataTablePaginationState,
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
import { useMemo, useState } from "react"
import { PriceListCreateModal } from "./forms/price-list-create-modal"
import { PriceListEditDrawer } from "./forms/price-list-edit-drawer"
import { PriceListPricesModal } from "./forms/price-list-prices-modal"

const columnHelper = createDataTableColumnHelper<VendorPriceList>()
const filterHelper = createDataTableFilterHelper<VendorPriceList>()

export const PriceListsTable = () => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [search, setSearch] = useState("")
  const [filtering, setFiltering] = useState<DataTableFilteringState>({})
  const [sorting, setSorting] = useState<DataTableSortingState | null>(null)
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  // Modal / Drawer states
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingPriceList, setEditingPriceList] = useState<VendorPriceList | null>(null)
  const [managingPricesPriceList, setManagingPricesPriceList] = useState<VendorPriceList | null>(null)

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const statusFilter = filtering.status as VendorPriceListStatus | undefined
  const typeFilter = filtering.type as VendorPriceListType | undefined

  const order = sorting
    ? (sorting.desc ? "-" : "") + sorting.id
    : undefined

  const { data, isLoading } = useQuery({
    queryKey: [
      "vendor-price-lists",
      { limit, offset, q: search, status: statusFilter, type: typeFilter, order },
    ],
    queryFn: () =>
      listVendorPriceLists({
        limit,
        offset,
        q: search || undefined,
        status: statusFilter,
        type: typeFilter,
        order,
      }),
  })

  // Fetch customer groups for resolving group names in table
  const { data: groupsData } = useQuery({
    queryKey: ["vendor-customer-groups", { limit: 100, offset: 0 }],
    queryFn: () => listVendorCustomerGroups({ limit: 100, offset: 0 }),
  })
  const customerGroups = useMemo(
    () => groupsData?.customer_groups ?? [],
    [groupsData]
  )

  const priceLists = data?.price_lists ?? []
  const count = data?.count ?? 0

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVendorPriceList(id),
    onSuccess: () => {
      toast.success("Price list deleted successfully")
      queryClient.invalidateQueries({ queryKey: ["vendor-price-lists"] })
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete price list")
    },
  })

  const handleDelete = async (priceList: VendorPriceList) => {
    const confirmed = await prompt({
      title: "Delete Price List",
      description: `Are you sure you want to delete "${priceList.title}"? This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
    })

    if (confirmed) {
      deleteMutation.mutate(priceList.id)
    }
  }

  const filters = useMemo(
    () => [
      filterHelper.accessor("status", {
        type: "select",
        label: "Status",
        options: [
          { label: "Active", value: "active" },
          { label: "Draft", value: "draft" },
        ],
      }),
      filterHelper.accessor("type", {
        type: "select",
        label: "Type",
        options: [
          { label: "Sale", value: "sale" },
          { label: "Override", value: "override" },
        ],
      }),
    ],
    []
  )

  const columns = useMemo(
    () => [
      columnHelper.accessor("title", {
        header: "Title",
        enableSorting: true,
        cell: ({ row }) => {
          const pl = row.original
          return (
            <Link
              href={`/pricing/${pl.id}`}
              className="flex items-center gap-x-3 group"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded bg-ui-bg-subtle text-ui-fg-subtle group-hover:text-ui-fg-base group-hover:bg-ui-bg-subtle-hover transition-colors">
                <CurrencyDollar className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <Text
                  size="small"
                  weight="plus"
                  className="group-hover:text-ui-fg-interactive transition-colors"
                >
                  {pl.title}
                </Text>
                {pl.description && (
                  <Text size="xsmall" className="text-ui-fg-subtle line-clamp-1">
                    {pl.description}
                  </Text>
                )}
              </div>
            </Link>
          )
        },
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: ({ getValue }) => {
          const status = getValue()
          return (
            <Badge size="small" color={status === "active" ? "green" : "grey"}>
              {status === "active" ? "Active" : "Draft"}
            </Badge>
          )
        },
      }),
      columnHelper.accessor("type", {
        header: "Type",
        cell: ({ getValue }) => {
          const type = getValue()
          return (
            <Badge size="small" color={type === "sale" ? "blue" : "purple"}
            >
              {type === "sale" ? "Sale" : "Override"}
            </Badge>
          )
        },
      }),
      columnHelper.display({
        id: "schedule",
        header: "Schedule",
        cell: ({ row }) => {
          const pl = row.original
          const now = new Date()

          if (!pl.starts_at && !pl.ends_at) {
            return (
              <Text size="small" className="text-ui-fg-subtle">
                Always active
              </Text>
            )
          }

          if (pl.ends_at && new Date(pl.ends_at) < now) {
            return (
              <Badge size="small" color="red">
                Expired
              </Badge>
            )
          }

          if (pl.starts_at && new Date(pl.starts_at) > now) {
            return (
              <Badge size="small" color="orange">
                Scheduled
              </Badge>
            )
          }

          if (pl.ends_at) {
            return (
              <Text size="small" className="text-ui-fg-subtle">
                Ends {new Date(pl.ends_at).toLocaleDateString()}
              </Text>
            )
          }

          return (
            <Text size="small" className="text-ui-fg-subtle">
              Active
            </Text>
          )
        },
      }),
      columnHelper.display({
        id: "customer_groups",
        header: "Customer Groups",
        cell: ({ row }) => {
          const pl = row.original
          const groupIds = pl.rules?.customer_group_id || []

          if (!groupIds.length) {
            return (
              <Text size="small" className="text-ui-fg-subtle">
                All Customers
              </Text>
            )
          }

          const matched = customerGroups.filter((g) =>
            groupIds.includes(g.id)
          )

          return (
            <div className="flex flex-wrap gap-1">
              {matched.slice(0, 2).map((g) => (
                <Badge key={g.id} size="small" color="blue">
                  {g.name}
                </Badge>
              ))}
              {groupIds.length > 2 && (
                <Badge size="small" color="grey">
                  +{groupIds.length - 2} more
                </Badge>
              )}
            </div>
          )
        },
      }),
      columnHelper.accessor("products_count", {
        header: "Products",
        cell: ({ getValue, row }) => {
          const count =
            getValue() ?? row.original.products?.length ?? 0
          return (
            <Badge size="small" color="grey">
              {count} {count === 1 ? "product" : "products"}
            </Badge>
          )
        },
      }),
      columnHelper.accessor("created_at", {
        header: "Created",
        enableSorting: true,
        cell: ({ getValue }) => {
          const date = getValue()
          return (
            <Text size="small" className="text-ui-fg-subtle">
              {date ? new Date(date).toLocaleDateString() : "-"}
            </Text>
          )
        },
      }),
      columnHelper.display({
        id: "actions",
        cell: ({ row }) => {
          const priceList = row.original
          return (
            <ActionMenu
              groups={[
                {
                  actions: [
                    {
                      label: "View Details",
                      icon: <Eye className="h-4 w-4" />,
                      onClick: () => router.push(`/pricing/${priceList.id}`),
                    },
                    {
                      label: "Edit Details",
                      icon: <PencilSquare className="h-4 w-4" />,
                      onClick: () => setEditingPriceList(priceList),
                    },
                    {
                      label: "Manage Prices",
                      icon: <CurrencyDollar className="h-4 w-4" />,
                      onClick: () => setManagingPricesPriceList(priceList),
                    },
                    {
                      label: "Delete",
                      icon: <Trash className="h-4 w-4 text-ui-fg-error" />,
                      onClick: () => handleDelete(priceList),
                    },
                  ],
                },
              ]}
            />
          )
        },
      }),
    ],
    [customerGroups, router]
  )

  const table = useDataTable({
    data: priceLists,
    columns,
    rowCount: count,
    getRowId: (row) => row.id,
    isLoading,
    filters,
    pagination: {
      state: pagination,
      onPaginationChange: setPagination,
    },
    search: {
      state: search,
      onSearchChange: setSearch,
    },
    filtering: {
      state: filtering,
      onFilteringChange: setFiltering,
    },
    sorting: {
      state: sorting,
      onSortingChange: setSorting,
    },
  })

  return (
    <div className="flex flex-col gap-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <Heading level="h1">Price Lists</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Manage custom prices, overrides, and sale discounts for your products and customer groups.
          </Text>
        </div>
        <Button size="small" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Create Price List
        </Button>
      </div>

      {/* Medusa DataTable */}
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex items-center justify-between">
          <div className="flex items-center gap-x-2">
            <DataTable.Search placeholder="Search price lists..." />
            <DataTable.FilterMenu />
          </div>
        </DataTable.Toolbar>

        <DataTable.Table />

        <DataTable.Pagination />
      </DataTable>

      {/* Create Modal */}
      <PriceListCreateModal
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["vendor-price-lists"] })
        }}
      />

      {/* Edit Drawer */}
      {editingPriceList && (
        <PriceListEditDrawer
          open={!!editingPriceList}
          onOpenChange={(open) => {
            if (!open) setEditingPriceList(null)
          }}
          priceList={editingPriceList}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["vendor-price-lists"] })
          }}
        />
      )}

      {/* Manage Prices Modal */}
      {managingPricesPriceList && (
        <PriceListPricesModal
          open={!!managingPricesPriceList}
          onOpenChange={(open) => {
            if (!open) setManagingPricesPriceList(null)
          }}
          priceList={managingPricesPriceList}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["vendor-price-lists"] })
          }}
        />
      )}
    </div>
  )
}
