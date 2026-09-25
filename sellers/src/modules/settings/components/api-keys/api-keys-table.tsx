"use client"

import {
  deleteVendorApiKey,
  listVendorApiKeys,
  revokeVendorApiKey,
  type VendorApiKey,
} from "@lib/data/vendor-client"
import {
  Key,
  PlusMini,
  SquareTwoStack,
  Trash,
  XCircle,
} from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  createDataTableColumnHelper,
  createDataTableFilterHelper,
  DataTable,
  DataTableFilteringState,
  DataTablePaginationState,
  DataTableSortingState,
  Heading,
  StatusBadge,
  Text,
  toast,
  useDataTable,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ApiKeyCreateModal } from "./api-key-create-modal"

const columnHelper = createDataTableColumnHelper<VendorApiKey>()
const filterHelper = createDataTableFilterHelper<VendorApiKey>()

const extractFilterValue = (val: any): string | undefined => {
  if (!val) return undefined
  if (typeof val === "string") return val
  if (Array.isArray(val)) return val[0]
  if (typeof val === "object") {
    const flat = Object.values(val).flat()
    return (flat[0] as string) || undefined
  }
  return undefined
}

const filters = [
  filterHelper.custom({
    id: "created_at_gte",
    label: "Created",
    type: "select",
    options: [
      { label: "Last 7 days", value: "7d" },
      { label: "Last 30 days", value: "30d" },
      { label: "Last 90 days", value: "90d" },
    ],
  }),
  filterHelper.custom({
    id: "updated_at_gte",
    label: "Updated",
    type: "select",
    options: [
      { label: "Last 7 days", value: "7d" },
      { label: "Last 30 days", value: "30d" },
      { label: "Last 90 days", value: "90d" },
    ],
  }),
  filterHelper.custom({
    id: "revoked_at",
    label: "Revoked",
    type: "select",
    options: [
      { label: "Revoked", value: "revoked" },
      { label: "Active", value: "active" },
      { label: "Last 7 days", value: "7d" },
      { label: "Last 30 days", value: "30d" },
      { label: "Last 90 days", value: "90d" },
    ],
  }),
]

type ApiKeysTableProps = {
  defaultTab?: "all" | "publishable" | "secret"
  fixedType?: "publishable" | "secret"
}

export const ApiKeysTable = ({ defaultTab, fixedType }: ApiKeysTableProps) => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const tabFromQuery = searchParams.get("tab") as
    | "all"
    | "publishable"
    | "secret"
    | null

  const initialTab =
    fixedType ||
    defaultTab ||
    (tabFromQuery === "publishable" || tabFromQuery === "secret"
      ? tabFromQuery
      : "publishable")

  const [activeTab, setActiveTab] = useState<"all" | "publishable" | "secret">(
    initialTab
  )
  const [createOpen, setCreateOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [sorting, setSorting] = useState<DataTableSortingState | null>(null)
  const [filtering, setFiltering] = useState<DataTableFilteringState>({})
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  // Sync tab with URL if tabFromQuery changes (only when not fixedType)
  useEffect(() => {
    if (fixedType) {
      setActiveTab(fixedType)
      return
    }
    if (tabFromQuery && (tabFromQuery === "all" || tabFromQuery === "publishable" || tabFromQuery === "secret")) {
      setActiveTab(tabFromQuery)
    }
  }, [tabFromQuery, fixedType])

  const handleTabChange = (tab: "all" | "publishable" | "secret") => {
    if (fixedType) return
    setActiveTab(tab)
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
    if (pathname.includes("/settings/api-keys")) {
      router.replace(`${pathname}?tab=${tab}`)
    }
  }

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const order = sorting
    ? (sorting.desc ? "-" : "") + sorting.id
    : undefined

  const dateCreatedVal = extractFilterValue(filtering.created_at_gte)
  const dateUpdatedVal = extractFilterValue(filtering.updated_at_gte)
  const revokedVal = extractFilterValue(filtering.revoked_at)

  const createdAtGte = useMemo(() => {
    if (!dateCreatedVal) return undefined
    const days = dateCreatedVal === "7d" ? 7 : dateCreatedVal === "30d" ? 30 : 90
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  }, [dateCreatedVal])

  const updatedAtGte = useMemo(() => {
    if (!dateUpdatedVal) return undefined
    const days = dateUpdatedVal === "7d" ? 7 : dateUpdatedVal === "30d" ? 30 : 90
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  }, [dateUpdatedVal])

  const revokedParam = useMemo(() => {
    if (!revokedVal) return undefined
    if (revokedVal === "revoked" || revokedVal === "active") return revokedVal
    const days = revokedVal === "7d" ? 7 : revokedVal === "30d" ? 30 : 90
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  }, [revokedVal])

  const { data, isLoading } = useQuery({
    queryKey: [
      "vendor-api-keys",
      limit,
      offset,
      activeTab,
      search,
      order,
      createdAtGte,
      updatedAtGte,
      revokedParam,
    ],
    queryFn: () =>
      listVendorApiKeys({
        limit,
        offset,
        type: activeTab === "all" ? undefined : activeTab,
        q: search || undefined,
        order,
        created_at_gte: createdAtGte,
        updated_at_gte: updatedAtGte,
        revoked_at: revokedParam,
      }),
    placeholderData: (previous) => previous,
  })

  const { mutateAsync: revokeKey } = useMutation({
    mutationFn: (id: string) => revokeVendorApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-api-keys"] })
    },
  })

  const { mutateAsync: removeKey } = useMutation({
    mutationFn: (id: string) => deleteVendorApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-api-keys"] })
    },
  })

  const handleRevoke = useCallback(
    async (key: VendorApiKey) => {
      const confirmed = await prompt({
        title: "Revoke API key",
        description: `Are you sure you want to revoke "${key.title}"? Any applications using this key will immediately lose access.`,
        confirmText: "Revoke",
        cancelText: "Cancel",
        variant: "danger",
      })

      if (!confirmed) {
        return
      }

      try {
        await revokeKey(key.id)
        toast.success(`API key "${key.title}" was revoked.`)
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not revoke the API key."
        )
      }
    },
    [prompt, revokeKey]
  )

  const handleDelete = useCallback(
    async (key: VendorApiKey) => {
      const confirmed = await prompt({
        title: "Delete API key",
        description: `Are you sure you want to permanently delete "${key.title}"?`,
        confirmText: "Delete",
        cancelText: "Cancel",
        variant: "danger",
      })

      if (!confirmed) {
        return
      }

      try {
        await removeKey(key.id)
        toast.success(`API key "${key.title}" was deleted.`)
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not delete the API key."
        )
      }
    },
    [prompt, removeKey]
  )

  const handleCopy = (token: string) => {
    navigator.clipboard.writeText(token)
    toast.success("API key copied to clipboard")
  }

  const columns = useMemo(
    () => {
      const cols: any[] = [
        columnHelper.accessor("title", {
          id: "title",
          header: "Key",
          enableSorting: true,
          sortLabel: "Title",
          sortAscLabel: "Ascending",
          sortDescLabel: "Descending",
          cell: ({ row }) => (
            <div className="flex items-center gap-x-2.5">
              <Key className="text-ui-fg-subtle h-4 w-4 shrink-0" />
              <div className="flex flex-col">
                <Text size="small" weight="plus" className="text-ui-fg-base">
                  {row.original.title}
                </Text>
                <div className="flex items-center gap-x-1 mt-0.5">
                  <span className="font-mono text-xs text-ui-fg-subtle">
                    {row.original.redacted ||
                      (row.original.token
                        ? row.original.token.slice(0, 16) + "..."
                        : "")}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(row.original.token || row.original.redacted)
                    }
                    className="text-ui-fg-subtle hover:text-ui-fg-base transition-colors p-0.5"
                    title="Copy token"
                  >
                    <SquareTwoStack className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          ),
        }),
      ]

      if (!fixedType) {
        cols.push(
          columnHelper.accessor("type", {
            id: "type",
            header: "Type",
            cell: ({ row }) => (
              <Badge
                size="small"
                color={row.original.type === "secret" ? "purple" : "blue"}
              >
                {row.original.type === "secret" ? "Secret" : "Publishable"}
              </Badge>
            ),
          })
        )
      }

      cols.push(
        columnHelper.accessor("created_at", {
          id: "created_at",
          header: "Created",
          enableSorting: true,
          sortLabel: "Created",
          sortAscLabel: "Ascending",
          sortDescLabel: "Descending",
          cell: ({ row }) => {
            const date = row.original.created_at
              ? new Date(row.original.created_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "-"
            return (
              <Text size="small" className="text-ui-fg-subtle">
                {date}
              </Text>
            )
          },
        }),
        columnHelper.accessor("updated_at", {
          id: "updated_at",
          header: "Updated",
          enableSorting: true,
          sortLabel: "Updated",
          sortAscLabel: "Ascending",
          sortDescLabel: "Descending",
          cell: ({ row }) => {
            const date = row.original.updated_at
              ? new Date(row.original.updated_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "-"
            return (
              <Text size="small" className="text-ui-fg-subtle">
                {date}
              </Text>
            )
          },
        }),
        columnHelper.accessor("revoked_at", {
          id: "revoked_at",
          header: "Status",
          enableSorting: true,
          sortLabel: "Revoked At",
          sortAscLabel: "Ascending",
          sortDescLabel: "Descending",
          cell: ({ row }) => {
            const isRevoked = !!row.original.revoked_at
            return (
              <StatusBadge color={isRevoked ? "red" : "green"}>
                {isRevoked ? "Revoked" : "Active"}
              </StatusBadge>
            )
          },
        }),
        columnHelper.action({
          actions: (ctx) => {
            const isRevoked = !!ctx.row.original.revoked_at
            const actionsList: any[] = [
              {
                label: "Copy Token",
                icon: <SquareTwoStack />,
                onClick: () =>
                  handleCopy(ctx.row.original.token || ctx.row.original.redacted),
              },
            ]

            if (!isRevoked) {
              actionsList.push({
                label: "Revoke Key",
                icon: <XCircle />,
                onClick: () => handleRevoke(ctx.row.original),
              })
            }

            actionsList.push({
              label: "Delete",
              icon: <Trash />,
              onClick: () => handleDelete(ctx.row.original),
            })

            return actionsList
          },
        })
      )

      return cols
    },
    [fixedType, handleRevoke, handleDelete]
  )

  const table = useDataTable({
    columns,
    data: data?.api_keys ?? [],
    rowCount: data?.count ?? 0,
    getRowId: (row) => row.id,
    isLoading,
    pagination: { state: pagination, onPaginationChange: setPagination },
    filtering: { state: filtering, onFilteringChange: setFiltering },
    sorting: { state: sorting, onSortingChange: setSorting },
    search: { state: search, onSearchChange: setSearch },
    filters,
  })

  return (
    <Container className="p-0">
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex flex-col gap-y-3 px-6 py-4">
          <div className="flex items-center justify-between gap-x-2">
            <div>
              <Heading level="h2">
                {activeTab === "publishable"
                  ? "Publishable API Keys"
                  : activeTab === "secret"
                  ? "Secret API Keys"
                  : "API Keys"}
              </Heading>
              <Text size="small" className="text-ui-fg-subtle">
                {activeTab === "publishable"
                  ? "Manage publishable API keys for client applications."
                  : activeTab === "secret"
                  ? "Manage secret API keys for backend integrations."
                  : "Generate and manage publishable and secret keys for API integrations."}
              </Text>
            </div>
            <Button
              size="small"
              variant="secondary"
              onClick={() => setCreateOpen(true)}
            >
              <PlusMini />
              Create API Key
            </Button>
          </div>

          {fixedType ? (
            <div className="flex items-center justify-end gap-x-2 border-b pb-3">
              <DataTable.Search placeholder="Search..." />
              <DataTable.FilterMenu tooltip="Filter" />
              <DataTable.SortingMenu tooltip="Sort" />
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
              <div className="flex items-center gap-x-2">
                <button
                  type="button"
                  className={`pb-1 px-1 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === "all"
                      ? "border-ui-fg-base text-ui-fg-base"
                      : "border-transparent text-ui-fg-subtle hover:text-ui-fg-base"
                  }`}
                  onClick={() => handleTabChange("all")}
                >
                  All Keys
                </button>
                <button
                  type="button"
                  className={`pb-1 px-1 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === "publishable"
                      ? "border-ui-fg-base text-ui-fg-base"
                      : "border-transparent text-ui-fg-subtle hover:text-ui-fg-base"
                  }`}
                  onClick={() => handleTabChange("publishable")}
                >
                  Publishable Keys
                </button>
                <button
                  type="button"
                  className={`pb-1 px-1 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === "secret"
                      ? "border-ui-fg-base text-ui-fg-base"
                      : "border-transparent text-ui-fg-subtle hover:text-ui-fg-base"
                  }`}
                  onClick={() => handleTabChange("secret")}
                >
                  Secret Keys
                </button>
              </div>
              <div className="flex items-center gap-x-2">
                <DataTable.Search placeholder="Search..." />
                <DataTable.FilterMenu tooltip="Filter" />
                <DataTable.SortingMenu tooltip="Sort" />
              </div>
            </div>
          )}
        </DataTable.Toolbar>
        <DataTable.FilterBar />
        <DataTable.Table
          emptyState={{
            empty: {
              heading: "No API keys",
              description: "Create an API key to get started.",
            },
            filtered: {
              heading: "No results found",
              description: "Try changing your search or filter options.",
            },
          }}
        />
        <DataTable.Pagination />
      </DataTable>

      <ApiKeyCreateModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultType={fixedType || (activeTab === "all" ? "publishable" : activeTab)}
        lockType={!!fixedType}
      />
    </Container>
  )
}
