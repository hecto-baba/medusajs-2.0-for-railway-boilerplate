"use client"

import {
  deleteVendorPromotion,
  listVendorPromotions,
  type VendorPromotion,
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
  StatusBadge,
  toast,
  useDataTable,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { PlaceholderCell } from "@modules/common"

const columnHelper = createDataTableColumnHelper<VendorPromotion>()
const filterHelper = createDataTableFilterHelper<VendorPromotion>()
const commandHelper = createDataTableCommandHelper()

const PROMOTION_STATUS: Record<string, ["grey" | "orange" | "green", string]> = {
  draft: ["grey", "Draft"],
  active: ["green", "Active"],
  inactive: ["orange", "Inactive"],
}

const PromotionStatusCell = ({ status }: { status?: string }) => {
  const variant = status ? PROMOTION_STATUS[status] : undefined

  if (!variant) {
    return <PlaceholderCell />
  }

  const [color, label] = variant

  return <StatusBadge color={color}>{label}</StatusBadge>
}

const formatValue = (promotion: VendorPromotion) => {
  const method = promotion.application_method

  if (!method) {
    return <PlaceholderCell />
  }

  if (method.type === "percentage") {
    return `${method.value}%`
  }

  return `${method.value} ${method.currency_code?.toUpperCase() ?? ""}`.trim()
}

const filters = [
  filterHelper.accessor("status", {
    label: "Status",
    type: "multiselect",
    options: [
      { label: "Draft", value: "draft" },
      { label: "Active", value: "active" },
      { label: "Inactive", value: "inactive" },
    ],
  }),
  filterHelper.accessor("type", {
    label: "Type",
    type: "multiselect",
    options: [
      { label: "Standard (Amount off)", value: "standard" },
      { label: "Buy X, get Y", value: "buyget" },
    ],
  }),
  filterHelper.accessor("created_at", {
    label: "Created",
    type: "radio",
    options: [
      { label: "All time", value: "all" },
      { label: "Past 7 days", value: "7d" },
      { label: "Past 30 days", value: "30d" },
      { label: "Past 90 days", value: "90d" },
    ],
  }),
  filterHelper.accessor("updated_at", {
    label: "Updated",
    type: "radio",
    options: [
      { label: "All time", value: "all" },
      { label: "Past 7 days", value: "7d" },
      { label: "Past 30 days", value: "30d" },
      { label: "Past 90 days", value: "90d" },
    ],
  }),
]

const useColumns = (onDelete: (promotion: VendorPromotion) => void) => [
  columnHelper.accessor("code", {
    id: "code",
    header: "Code",
    enableSorting: true,
    sortLabel: "Code",
    sortAscLabel: "Ascending",
    sortDescLabel: "Descending",
    cell: ({ row }) => <span className="truncate font-medium">{row.original.code}</span>,
  }),
  columnHelper.accessor("type", {
    id: "type",
    header: "Type",
    enableSorting: true,
    sortLabel: "Type",
    sortAscLabel: "Ascending",
    sortDescLabel: "Descending",
    cell: ({ row }) =>
      row.original.type === "buyget" ? "Buy X, get Y" : "Amount off",
  }),
  columnHelper.display({
    id: "value",
    header: "Value",
    cell: ({ row }) => formatValue(row.original),
  }),
  columnHelper.accessor("status", {
    id: "status",
    header: "Status",
    enableSorting: true,
    sortLabel: "Status",
    sortAscLabel: "Ascending",
    sortDescLabel: "Descending",
    cell: ({ row }) => <PromotionStatusCell status={row.original.status} />,
  }),
  columnHelper.accessor("created_at", {
    id: "created_at",
    header: "Created",
    enableSorting: true,
    sortLabel: "Created",
    sortAscLabel: "Ascending",
    sortDescLabel: "Descending",
    cell: ({ row }) =>
      new Date(row.original.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
  }),
  columnHelper.accessor("updated_at", {
    id: "updated_at",
    header: "Updated",
    enableSorting: true,
    sortLabel: "Updated",
    sortAscLabel: "Ascending",
    sortDescLabel: "Descending",
    cell: ({ row }) =>
      row.original.updated_at ? (
        new Date(row.original.updated_at).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      ) : (
        <PlaceholderCell />
      ),
  }),
  columnHelper.action({
    actions: [
      {
        label: "Edit",
        onClick: (ctx) => {
          window.location.href = `/promotions/${ctx.row.original.id}`
        },
      },
      {
        label: "Delete",
        onClick: (ctx) => onDelete(ctx.row.original),
      },
    ],
  }),
]

export const PromotionsTable = () => {
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

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const statusFilter = filtering.status
  const status = Array.isArray(statusFilter)
    ? (statusFilter as string[])
    : statusFilter
      ? (Object.values(statusFilter).flat() as string[])
      : undefined

  const typeFilter = filtering.type
  const type = Array.isArray(typeFilter)
    ? (typeFilter as string[])
    : typeFilter
      ? (Object.values(typeFilter).flat() as string[])
      : undefined

  const resolveDateFilter = (val: any): string | undefined => {
    if (!val || val === "all") return undefined
    if (typeof val === "object") {
      if (val.$gte) return typeof val.$gte === "string" ? val.$gte : new Date(val.$gte).toISOString()
      const flat = Object.values(val).flat()
      val = flat[0]
    }
    if (Array.isArray(val)) val = val[0]
    if (typeof val !== "string" || val === "all") return undefined
    const now = new Date()
    if (val === "7d") {
      now.setDate(now.getDate() - 7)
      return now.toISOString()
    }
    if (val === "30d") {
      now.setDate(now.getDate() - 30)
      return now.toISOString()
    }
    if (val === "90d") {
      now.setDate(now.getDate() - 90)
      return now.toISOString()
    }
    if (!isNaN(Date.parse(val))) {
      return new Date(val).toISOString()
    }
    return undefined
  }

  const created_at_gte = resolveDateFilter(filtering.created_at)
  const updated_at_gte = resolveDateFilter(filtering.updated_at)

  const order = sorting ? (sorting.desc ? "-" : "") + sorting.id : undefined

  const { data, isLoading } = useQuery({
    queryKey: [
      "vendor-promotions",
      limit,
      offset,
      search,
      status,
      type,
      created_at_gte,
      updated_at_gte,
      order,
    ],
    queryFn: () =>
      listVendorPromotions({
        limit,
        offset,
        q: search || undefined,
        status: status?.length ? status : undefined,
        type: type?.length ? type : undefined,
        created_at_gte,
        updated_at_gte,
        order,
      }),
    placeholderData: (previous) => previous,
  })

  const { mutateAsync: remove } = useMutation({
    mutationFn: (id: string) => deleteVendorPromotion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-promotions"] })
    },
  })

  const handleDelete = async (promotion: VendorPromotion) => {
    const confirmed = await prompt({
      title: "Delete promotion",
      description: `Are you sure you want to delete "${promotion.code}"? This cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
    })

    if (!confirmed) {
      return
    }

    try {
      await remove(promotion.id)
      toast.success(`"${promotion.code}" was deleted.`)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not delete the promotion."
      )
    }
  }

  const commands = [
    commandHelper.command({
      label: "Delete",
      shortcut: "d",
      action: async (selection) => {
        const ids = Object.keys(selection)

        const confirmed = await prompt({
          title: "Delete promotions",
          description:
            "Delete " +
            ids.length +
            (ids.length === 1 ? " promotion" : " promotions") +
            "? This cannot be undone.",
          confirmText: "Delete",
          cancelText: "Cancel",
        })

        if (!confirmed) {
          return
        }

        const failures: string[] = []

        for (const id of ids) {
          try {
            await deleteVendorPromotion(id)
          } catch {
            failures.push(id)
          }
        }

        queryClient.invalidateQueries({ queryKey: ["vendor-promotions"] })
        setRowSelection({})

        if (failures.length) {
          toast.error(
            failures.length + " of " + ids.length + " could not be deleted."
          )
          return
        }

        toast.success(
          ids.length +
            (ids.length === 1 ? " promotion" : " promotions") +
            " deleted."
        )
      },
    }),
  ]

  const table = useDataTable({
    data: data?.promotions ?? [],
    columns: useColumns(handleDelete),
    getRowId: (promotion) => promotion.id,
    rowCount: data?.count ?? 0,
    isLoading,
    onRowClick: (_event, row) => router.push(`/promotions/${row.id}`),
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

  return (
    <DataTable instance={table}>
      <DataTable.Toolbar className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Promotions</Heading>
        <div className="flex items-center gap-x-2">
          <DataTable.Search placeholder="Search promotions..." />
          <DataTable.FilterMenu tooltip="Filter" />
          <DataTable.SortingMenu tooltip="Sort" />
          <Link
            href="/promotions/new"
            className="bg-ui-button-inverted text-ui-contrast-fg-primary shadow-buttons-inverted txt-compact-small-plus rounded-md px-3 py-1.5"
          >
            Create
          </Link>
        </div>
      </DataTable.Toolbar>
      <DataTable.FilterBar />
      <DataTable.Table
        emptyState={{
          empty: {
            heading: "No promotions yet",
            description: "Create your first promotion to offer a discount.",
          },
          filtered: {
            heading: "No matches",
            description: "No promotions match that search.",
          },
        }}
      />
      <DataTable.Pagination />
      <DataTable.CommandBar selectedLabel={(count) => count + " selected"} />
    </DataTable>
  )
}
