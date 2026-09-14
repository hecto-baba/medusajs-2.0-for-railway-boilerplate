"use client"

import {
  deleteVendorApiKey,
  listVendorApiKeys,
  revokeVendorApiKey,
  type VendorApiKey,
} from "@lib/data/vendor-client"
import {
  Check,
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
  DataTable,
  DataTablePaginationState,
  Heading,
  StatusBadge,
  Text,
  toast,
  useDataTable,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { ApiKeyCreateModal } from "./api-key-create-modal"

const columnHelper = createDataTableColumnHelper<VendorApiKey>()

export const ApiKeysTable = () => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [activeTab, setActiveTab] = useState<"all" | "publishable" | "secret">("all")
  const [createOpen, setCreateOpen] = useState(false)
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-api-keys", limit, offset, activeTab],
    queryFn: () =>
      listVendorApiKeys({
        limit,
        offset,
        type: activeTab === "all" ? undefined : activeTab,
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

  const handleRevoke = async (key: VendorApiKey) => {
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
  }

  const handleDelete = async (key: VendorApiKey) => {
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
  }

  const handleCopy = (token: string) => {
    navigator.clipboard.writeText(token)
    toast.success("API key copied to clipboard")
  }

  const columns = [
    columnHelper.accessor("title", {
      header: "Key",
      cell: ({ row }) => (
        <div className="flex items-center gap-x-2.5">
          <Key className="text-ui-fg-subtle h-4 w-4" />
          <div className="flex flex-col">
            <Text size="small" weight="plus" className="text-ui-fg-base">
              {row.original.title}
            </Text>
            <div className="flex items-center gap-x-1 mt-0.5">
              <span className="font-mono text-xs text-ui-fg-subtle">
                {row.original.redacted || row.original.token?.slice(0, 16) + "..."}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(row.original.token || row.original.redacted)}
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
    columnHelper.accessor("type", {
      header: "Type",
      cell: ({ row }) => (
        <Badge
          size="small"
          color={row.original.type === "secret" ? "purple" : "blue"}
        >
          {row.original.type === "secret" ? "Secret" : "Publishable"}
        </Badge>
      ),
    }),
    columnHelper.accessor("revoked_at", {
      header: "Status",
      cell: ({ row }) => {
        const isRevoked = !!row.original.revoked_at
        return (
          <StatusBadge color={isRevoked ? "red" : "green"}>
            {isRevoked ? "Revoked" : "Active"}
          </StatusBadge>
        )
      },
    }),
    columnHelper.accessor("created_at", {
      header: "Created",
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
    }),
  ]

  const table = useDataTable({
    columns,
    data: data?.api_keys ?? [],
    rowCount: data?.count ?? 0,
    getRowId: (row) => row.id,
    isLoading,
    pagination: { state: pagination, onPaginationChange: setPagination },
  })

  return (
    <Container className="p-0">
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex flex-col gap-y-3 px-6 py-4">
          <div className="flex items-center justify-between gap-x-2">
            <div>
              <Heading level="h2">API Keys</Heading>
              <Text size="small" className="text-ui-fg-subtle">
                Generate and manage publishable and secret keys for API integrations.
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

          <div className="flex items-center gap-x-2 border-b pt-2">
            <button
              type="button"
              className={`pb-2 px-1 text-sm font-medium transition-colors border-b-2 ${
                activeTab === "all"
                  ? "border-ui-fg-base text-ui-fg-base"
                  : "border-transparent text-ui-fg-subtle hover:text-ui-fg-base"
              }`}
              onClick={() => setActiveTab("all")}
            >
              All Keys
            </button>
            <button
              type="button"
              className={`pb-2 px-1 text-sm font-medium transition-colors border-b-2 ${
                activeTab === "publishable"
                  ? "border-ui-fg-base text-ui-fg-base"
                  : "border-transparent text-ui-fg-subtle hover:text-ui-fg-base"
              }`}
              onClick={() => setActiveTab("publishable")}
            >
              Publishable Keys
            </button>
            <button
              type="button"
              className={`pb-2 px-1 text-sm font-medium transition-colors border-b-2 ${
                activeTab === "secret"
                  ? "border-ui-fg-base text-ui-fg-base"
                  : "border-transparent text-ui-fg-subtle hover:text-ui-fg-base"
              }`}
              onClick={() => setActiveTab("secret")}
            >
              Secret Keys
            </button>
          </div>
        </DataTable.Toolbar>
        <DataTable.Table />
        <DataTable.Pagination />
      </DataTable>

      <ApiKeyCreateModal
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </Container>
  )
}
