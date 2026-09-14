"use client"

import {
  deleteVendorReturnReason,
  listVendorReturnReasons,
  type VendorReturnReason,
} from "@lib/data/vendor-client"
import { PencilSquare, PlusMini, Trash } from "@medusajs/icons"
import {
  Button,
  Container,
  createDataTableColumnHelper,
  DataTable,
  DataTablePaginationState,
  Heading,
  toast,
  useDataTable,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useState } from "react"

const columnHelper = createDataTableColumnHelper<VendorReturnReason>()

/**
 * List table for return reasons. There is no detail page - edit and delete
 * are both row actions, matching the admin's return-reason-list, which also
 * has only a list and modals.
 */
export const ReturnReasonsTable = () => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const router = useRouter()

  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-return-reasons", limit, offset],
    queryFn: () => listVendorReturnReasons({ limit, offset }),
    placeholderData: (previous) => previous,
  })

  const { mutateAsync: remove } = useMutation({
    mutationFn: (id: string) => deleteVendorReturnReason(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-return-reasons"] })
    },
  })

  const handleDelete = async (reason: VendorReturnReason) => {
    const confirmed = await prompt({
      title: "Delete return reason",
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
        error instanceof Error ? error.message : "Could not delete the return reason."
      )
    }
  }

  const columns = [
    columnHelper.accessor("label", { header: "Label" }),
    columnHelper.accessor("value", { header: "Value" }),
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
            router.push(`/settings/return-reasons/${ctx.row.original.id}/edit`)
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
    data: data?.return_reasons ?? [],
    rowCount: data?.count ?? 0,
    getRowId: (row) => row.id,
    isLoading,
    pagination: { state: pagination, onPaginationChange: setPagination },
  })

  return (
    <Container className="p-0">
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex items-center justify-between gap-x-2 px-6 py-4">
          <Heading>Return Reasons</Heading>
          <Button
            size="small"
            variant="secondary"
            onClick={() => router.push("/settings/return-reasons/create")}
          >
            <PlusMini />
            Create
          </Button>
        </DataTable.Toolbar>
        <DataTable.Table />
        <DataTable.Pagination />
      </DataTable>
    </Container>
  )
}
