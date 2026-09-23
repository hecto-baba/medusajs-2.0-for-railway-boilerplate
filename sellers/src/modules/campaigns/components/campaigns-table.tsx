"use client"

import {
  deleteVendorCampaign,
  listVendorCampaigns,
  type VendorCampaign,
} from "@lib/data/vendor-client"
import {
  createDataTableColumnHelper,
  createDataTableCommandHelper,
  DataTable,
  DataTablePaginationState,
  DataTableRowSelectionState,
  DataTableSortingState,
  DropdownMenu,
  Heading,
  IconButton,
  toast,
  useDataTable,
  usePrompt,
} from "@medusajs/ui"
import { EllipsisHorizontal, PencilSquare, Trash } from "@medusajs/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { format } from "date-fns"

const columnHelper = createDataTableColumnHelper<VendorCampaign>()
const commandHelper = createDataTableCommandHelper()

const formatDate = (dateString?: string | null) => {
  if (!dateString) return "—"
  try {
    return format(new Date(dateString), "MMM d, yyyy")
  } catch {
    return "—"
  }
}

const formatBudget = (campaign: VendorCampaign) => {
  if (!campaign.budget) return "—"
  const { type, limit, currency_code, attribute } = campaign.budget
  if (limit === null || limit === undefined) {
    return type === "spend" ? "Spend (No limit)" : "Usage (No limit)"
  }
  if (type === "spend") {
    return `${limit} ${currency_code?.toUpperCase() ?? ""}`.trim()
  }
  const scope =
    attribute === "customer_id"
      ? " per customer"
      : attribute === "customer_email"
        ? " per email"
        : ""
  return `${limit} uses${scope}`
}

const useColumns = (onDelete: (campaign: VendorCampaign) => void) => [
  columnHelper.accessor("name", {
    id: "name",
    header: "Name",
    enableSorting: true,
    sortLabel: "Name",
    sortAscLabel: "A-Z",
    sortDescLabel: "Z-A",
    cell: ({ row }) => (
      <span className="font-medium text-ui-fg-base truncate">
        {row.original.name}
      </span>
    ),
  }),
  columnHelper.accessor("description", {
    id: "description",
    header: "Description",
    cell: ({ row }) => (
      <span className="text-ui-fg-subtle truncate">
        {row.original.description || "—"}
      </span>
    ),
  }),
  columnHelper.accessor("campaign_identifier", {
    id: "campaign_identifier",
    header: "Identifier",
    cell: ({ row }) => (
      <span className="font-mono text-ui-fg-subtle text-xs bg-ui-bg-subtle px-1.5 py-0.5 rounded border border-ui-border-base">
        {row.original.campaign_identifier}
      </span>
    ),
  }),
  columnHelper.accessor("starts_at", {
    id: "starts_at",
    header: "Start Date",
    cell: ({ row }) => (
      <span className="text-ui-fg-subtle text-xs">
        {formatDate(row.original.starts_at)}
      </span>
    ),
  }),
  columnHelper.accessor("ends_at", {
    id: "ends_at",
    header: "End Date",
    cell: ({ row }) => (
      <span className="text-ui-fg-subtle text-xs">
        {formatDate(row.original.ends_at)}
      </span>
    ),
  }),
  columnHelper.display({
    id: "budget",
    header: "Budget",
    cell: ({ row }) => (
      <span className="text-ui-fg-base text-xs font-medium">
        {formatBudget(row.original)}
      </span>
    ),
  }),
  columnHelper.display({
    id: "actions",
    header: "",
    cell: ({ row }) => {
      const campaign = row.original
      return (
        <div
          className="flex justify-end"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenu.Trigger asChild>
              <IconButton size="small" variant="transparent">
                <EllipsisHorizontal className="text-ui-fg-subtle" />
              </IconButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
              <DropdownMenu.Item asChild>
                <Link
                  href={`/promotions/campaigns/${campaign.id}`}
                  className="flex items-center gap-x-2"
                >
                  <PencilSquare className="text-ui-fg-subtle" />
                  <span>Edit</span>
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Item
                className="text-ui-fg-error focus:text-ui-fg-error"
                onClick={() => onDelete(campaign)}
              >
                <Trash className="text-ui-fg-error mr-2" />
                <span>Delete</span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
        </div>
      )
    },
  }),
]

export const CampaignsTable = () => {
  const router = useRouter()
  const prompt = usePrompt()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [rowSelection, setRowSelection] = useState<DataTableRowSelectionState>({})
  const [sorting, setSorting] = useState<DataTableSortingState | null>(null)
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 15,
  })

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit
  const order = sorting ? (sorting.desc ? "-" : "") + sorting.id : undefined

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-campaigns", limit, offset, search, order],
    queryFn: () =>
      listVendorCampaigns({
        limit,
        offset,
        q: search || undefined,
        order,
      }),
    placeholderData: (previous) => previous,
  })

  const { mutateAsync: remove } = useMutation({
    mutationFn: (id: string) => deleteVendorCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-campaigns"] })
    },
  })

  const handleDelete = async (campaign: VendorCampaign) => {
    const confirmed = await prompt({
      title: "Delete campaign",
      description: `Are you sure you want to delete "${campaign.name}"? This cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
    })

    if (!confirmed) return

    try {
      await remove(campaign.id)
      toast.success(`"${campaign.name}" was deleted.`)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete the campaign."
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
          title: "Delete campaigns",
          description: `Delete ${ids.length} ${
            ids.length === 1 ? "campaign" : "campaigns"
          }? This cannot be undone.`,
          confirmText: "Delete",
          cancelText: "Cancel",
        })

        if (!confirmed) return

        const failures: string[] = []
        for (const id of ids) {
          try {
            await deleteVendorCampaign(id)
          } catch {
            failures.push(id)
          }
        }

        queryClient.invalidateQueries({ queryKey: ["vendor-campaigns"] })
        setRowSelection({})

        if (failures.length) {
          toast.error(`${failures.length} of ${ids.length} could not be deleted.`)
          return
        }

        toast.success(`${ids.length} ${ids.length === 1 ? "campaign" : "campaigns"} deleted.`)
      },
    }),
  ]

  const table = useDataTable({
    data: data?.campaigns ?? [],
    columns: useColumns(handleDelete),
    getRowId: (campaign) => campaign.id,
    rowCount: data?.count ?? 0,
    isLoading,
    onRowClick: (_event, row) => router.push(`/promotions/campaigns/${row.id}`),
    search: {
      state: search,
      onSearchChange: (value) => {
        setSearch(value)
        setPagination((state) => ({ ...state, pageIndex: 0 }))
      },
    },
    commands,
    rowSelection: {
      state: rowSelection,
      onRowSelectionChange: setRowSelection,
    },
    sorting: {
      state: sorting,
      onSortingChange: (value) => {
        setSorting(value)
        setPagination((state) => ({ ...state, pageIndex: 0 }))
      },
    },
    pagination: {
      state: pagination,
      onPaginationChange: setPagination,
    },
  })

  return (
    <DataTable instance={table}>
      <DataTable.Toolbar className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Campaigns</Heading>
        <div className="flex items-center gap-x-2">
          <DataTable.Search placeholder="Search campaigns..." />
          <DataTable.SortingMenu tooltip="Sort" />
          <Link
            href="/promotions/campaigns/new"
            className="bg-ui-button-inverted text-ui-contrast-fg-primary shadow-buttons-inverted txt-compact-small-plus rounded-md px-3 py-1.5"
          >
            Create
          </Link>
        </div>
      </DataTable.Toolbar>
      <DataTable.Table
        emptyState={{
          empty: {
            heading: "No campaigns yet",
            description: "Create your first campaign to group and budget your promotions.",
          },
          filtered: {
            heading: "No matches",
            description: "No campaigns match that search.",
          },
        }}
      />
      <DataTable.Pagination />
      <DataTable.CommandBar selectedLabel={(count) => `${count} selected`} />
    </DataTable>
  )
}
