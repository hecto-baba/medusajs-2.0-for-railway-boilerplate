"use client"

import {
  deleteVendorRefundReason,
  listVendorRefundReasons,
  type VendorRefundReason,
} from "@lib/data/vendor-client"
import { PencilSquare, PlusMini, Trash } from "@medusajs/icons"
import {
  Button,
  Container,
  createDataTableColumnHelper,
  DataTable,
  DataTablePaginationState,
  DataTableSortingState,
  Heading,
  toast,
  useDataTable,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useState } from "react"

const columnHelper = createDataTableColumnHelper<VendorRefundReason>()

/** Mirrors return-reasons-table.tsx. */
export const RefundReasonsTable = () => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const router = useRouter()

  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const [search, setSearch] = useState("")
  const [sorting, setSorting] = useState<DataTableSortingState | null>(null)

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit
  const order = sorting?.id
    ? sorting.desc
      ? `-${sorting.id}`
      : sorting.id
    : undefined

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-refund-reasons", limit, offset, search, order],
    queryFn: () =>
      listVendorRefundReasons({
        limit,
        offset,
        q: search.trim() || undefined,
        order,
      }),
    placeholderData: (previous) => previous,
  })

  const { mutateAsync: remove } = useMutation({
    mutationFn: (id: string) => deleteVendorRefundReason(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-refund-reasons"] })
    },
  })

  const handleDelete = async (reason: VendorRefundReason) => {
    const confirmed = await prompt({
      title: "Delete refund reason",
      description: `Are you sure you want to delete "${reason.label}"? This cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
    })

    if (!confirmed) {
      return
    }

    try {
      await remove(reason.id)
      toast.success(`"${reason.label}" was deleted.`)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete the refund reason."
      )
    }
  }

  const columns = [
    columnHelper.accessor("label", {
      header: "Label",
      enableSorting: true,
    }),
    columnHelper.accessor("code", {
      header: "Code",
      enableSorting: true,
    }),
    columnHelper.accessor("description", {
      header: "Description",
      cell: ({ row }) => row.original.description || "-",
    }),
    columnHelper.action({
      actions: (ctx) => [
        {
          label: "Edit",
          icon: <PencilSquare />,
          onClick: () => {
            router.push(`/settings/refund-reasons/${ctx.row.original.id}/edit`)
          },
        },
        {
          label: "Delete",
          icon: <Trash />,
          onClick: () => handleDelete(ctx.row.original),
        },
      ],
    }),
  ]

  const table = useDataTable({
    columns,
    data: data?.refund_reasons ?? [],
    rowCount: data?.count ?? 0,
    getRowId: (row) => row.id,
    isLoading,
    pagination: { state: pagination, onPaginationChange: setPagination },
    search: { state: search, onSearchChange: setSearch },
    sorting: { state: sorting, onSortingChange: setSorting },
  })

  return (
    <Container className="p-0">
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-4">
          <Heading>Refund Reasons</Heading>
          <div className="flex items-center gap-x-2 w-full sm:w-auto">
            <DataTable.Search placeholder="Search refund reasons..." />
            <Button
              size="small"
              variant="secondary"
              onClick={() => router.push("/settings/refund-reasons/create")}
              className="shrink-0"
            >
              <PlusMini />
              Create
            </Button>
          </div>
        </DataTable.Toolbar>
        <DataTable.Table />
        <DataTable.Pagination />
      </DataTable>
    </Container>
  )
}
