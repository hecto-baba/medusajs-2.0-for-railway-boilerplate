"use client"

import {
  createVendorShippingOptionType,
  deleteVendorShippingOptionType,
  listVendorShippingOptionTypes,
  updateVendorShippingOptionType,
  type VendorShippingOptionType,
} from "@lib/data/vendor-client"
import { PencilSquare, PlusMini, Trash, TruckFast } from "@medusajs/icons"
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
  Drawer,
  Heading,
  Input,
  Label,
  Text,
  toast,
  useDataTable,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useMemo, useState } from "react"

const columnHelper = createDataTableColumnHelper<VendorShippingOptionType>()
const filterHelper = createDataTableFilterHelper<VendorShippingOptionType>()

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

const generateCodeFromLabel = (label: string) => {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
}

const filters = [
  filterHelper.custom({
    id: "created_at",
    label: "Created",
    type: "select",
    options: [
      { label: "Last 7 days", value: "7d" },
      { label: "Last 30 days", value: "30d" },
      { label: "Last 90 days", value: "90d" },
    ],
  }),
  filterHelper.custom({
    id: "updated_at",
    label: "Updated",
    type: "select",
    options: [
      { label: "Last 7 days", value: "7d" },
      { label: "Last 30 days", value: "30d" },
      { label: "Last 90 days", value: "90d" },
    ],
  }),
]

export const ShippingOptionTypesCard = () => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<VendorShippingOptionType | null>(null)

  // Create form state
  const [label, setLabel] = useState("")
  const [code, setCode] = useState("")
  const [description, setDescription] = useState("")
  const [codeTouched, setCodeTouched] = useState(false)

  // Edit form state
  const [editLabel, setEditLabel] = useState("")
  const [editCode, setEditCode] = useState("")
  const [editDescription, setEditDescription] = useState("")

  const [search, setSearch] = useState("")
  const [sorting, setSorting] = useState<DataTableSortingState | null>(null)
  const [filtering, setFiltering] = useState<DataTableFilteringState>({})
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const order = sorting
    ? (sorting.desc ? "-" : "") + sorting.id
    : undefined

  const createdVal = extractFilterValue(filtering.created_at)
  const updatedVal = extractFilterValue(filtering.updated_at)

  const createdAtGte = useMemo(() => {
    if (!createdVal) return undefined
    const days = createdVal === "7d" ? 7 : createdVal === "30d" ? 30 : 90
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  }, [createdVal])

  const updatedAtGte = useMemo(() => {
    if (!updatedVal) return undefined
    const days = updatedVal === "7d" ? 7 : updatedVal === "30d" ? 30 : 90
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  }, [updatedVal])

  const { data, isLoading } = useQuery({
    queryKey: [
      "vendor-shipping-option-types",
      limit,
      offset,
      search,
      createdAtGte,
      updatedAtGte,
      order,
    ],
    queryFn: () =>
      listVendorShippingOptionTypes({
        limit,
        offset,
        q: search || undefined,
        created_at_gte: createdAtGte,
        updated_at_gte: updatedAtGte,
        order,
      }),
    placeholderData: (previous) => previous,
  })

  const { mutateAsync: removeOptionType } = useMutation({
    mutationFn: (id: string) => deleteVendorShippingOptionType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-shipping-option-types"] })
    },
  })

  const handleDelete = useCallback(
    async (item: VendorShippingOptionType) => {
      const confirmed = await prompt({
        title: "Delete shipping option type",
        description: `Are you sure you want to delete "${item.label}"? This cannot be undone.`,
        confirmText: "Delete",
        cancelText: "Cancel",
        variant: "danger",
      })

      if (!confirmed) {
        return
      }

      try {
        await removeOptionType(item.id)
        toast.success(`Shipping option type "${item.label}" was deleted.`)
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not delete shipping option type."
        )
      }
    },
    [prompt, removeOptionType]
  )

  const createMutation = useMutation({
    mutationFn: () =>
      createVendorShippingOptionType({
        label: label.trim(),
        code: code.trim(),
        description: description.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Shipping option type created")
      queryClient.invalidateQueries({ queryKey: ["vendor-shipping-option-types"] })
      setCreateOpen(false)
      setLabel("")
      setCode("")
      setDescription("")
      setCodeTouched(false)
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create shipping option type")
    },
  })

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!label.trim()) {
      toast.error("Label is required")
      return
    }
    if (!code.trim()) {
      toast.error("Code is required")
      return
    }
    createMutation.mutate()
  }

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!selectedType) throw new Error("No type selected")
      return updateVendorShippingOptionType(selectedType.id, {
        label: editLabel.trim(),
        code: editCode.trim(),
        description: editDescription.trim() || undefined,
      })
    },
    onSuccess: () => {
      toast.success("Shipping option type updated")
      queryClient.invalidateQueries({ queryKey: ["vendor-shipping-option-types"] })
      setEditOpen(false)
      setSelectedType(null)
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update shipping option type")
    },
  })

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editLabel.trim()) {
      toast.error("Label is required")
      return
    }
    if (!editCode.trim()) {
      toast.error("Code is required")
      return
    }
    updateMutation.mutate()
  }

  const openEditDrawer = (item: VendorShippingOptionType) => {
    setSelectedType(item)
    setEditLabel(item.label)
    setEditCode(item.code)
    setEditDescription(item.description || "")
    setEditOpen(true)
  }

  const columns = useMemo(
    () => [
      columnHelper.accessor("label", {
        id: "label",
        header: "Label",
        enableSorting: true,
        sortLabel: "Label",
        sortAscLabel: "Ascending",
        sortDescLabel: "Descending",
        cell: ({ row }) => (
          <div className="flex items-center gap-x-2">
            <TruckFast className="text-ui-fg-subtle shrink-0" />
            <Text size="small" weight="plus" className="text-ui-fg-base">
              {row.original.label}
            </Text>
          </div>
        ),
      }),
      columnHelper.accessor("code", {
        id: "code",
        header: "Code",
        enableSorting: true,
        sortLabel: "Code",
        sortAscLabel: "Ascending",
        sortDescLabel: "Descending",
        cell: ({ row }) => (
          <Badge size="small" color="grey">
            {row.original.code}
          </Badge>
        ),
      }),
      columnHelper.accessor("description", {
        id: "description",
        header: "Description",
        enableSorting: true,
        sortLabel: "Description",
        sortAscLabel: "Ascending",
        sortDescLabel: "Descending",
        cell: ({ row }) => (
          <Text size="small" className="text-ui-fg-subtle line-clamp-1">
            {row.original.description || "-"}
          </Text>
        ),
      }),
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
      columnHelper.action({
        actions: (ctx) => [
          {
            label: "Edit",
            icon: <PencilSquare />,
            onClick: () => openEditDrawer(ctx.row.original),
          },
          {
            label: "Delete",
            icon: <Trash />,
            onClick: () => handleDelete(ctx.row.original),
          },
        ],
      }),
    ],
    [handleDelete]
  )

  const table = useDataTable({
    columns,
    data: data?.shipping_option_types ?? [],
    rowCount: data?.count ?? data?.shipping_option_types?.length ?? 0,
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
              <Heading level="h2">Shipping Option Types</Heading>
              <Text size="small" className="text-ui-fg-subtle">
                Manage shipping option types for delivery and return options.
              </Text>
            </div>
            <Button
              size="small"
              variant="secondary"
              onClick={() => {
                setLabel("")
                setCode("")
                setDescription("")
                setCodeTouched(false)
                setCreateOpen(true)
              }}
            >
              <PlusMini />
              Create Type
            </Button>
          </div>

          <div className="flex items-center justify-end gap-x-2 border-b pb-3">
            <DataTable.Search placeholder="Search..." />
            <DataTable.FilterMenu tooltip="Filter" />
            <DataTable.SortingMenu tooltip="Sort" />
          </div>
        </DataTable.Toolbar>

        <DataTable.FilterBar />

        <DataTable.Table
          emptyState={{
            empty: {
              heading: "No shipping option types",
              description: "Create a shipping option type to get started.",
            },
            filtered: {
              heading: "No results found",
              description: "Try changing your search or filter options.",
            },
          }}
        />

        <DataTable.Pagination />
      </DataTable>

      {/* Create Drawer */}
      <Drawer open={createOpen} onOpenChange={setCreateOpen}>
        <Drawer.Content className="max-w-md">
          <Drawer.Header>
            <Drawer.Title asChild>
              <Heading level="h2">Create Shipping Option Type</Heading>
            </Drawer.Title>
            <Drawer.Description className="text-ui-fg-subtle text-sm">
              Define the label, code, and description for this shipping option type.
            </Drawer.Description>
          </Drawer.Header>

          <form onSubmit={handleCreateSubmit} className="flex flex-1 flex-col justify-between">
            <Drawer.Body className="flex flex-col gap-y-4 p-6">
              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  Label <span className="text-ui-fg-error">*</span>
                </Label>
                <Input
                  placeholder="e.g. Express, Standard, Economy"
                  value={label}
                  onChange={(e) => {
                    const newLabel = e.target.value
                    setLabel(newLabel)
                    if (!codeTouched) {
                      setCode(generateCodeFromLabel(newLabel))
                    }
                  }}
                  required
                />
              </div>

              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  Code <span className="text-ui-fg-error">*</span>
                </Label>
                <Input
                  placeholder="e.g. express, standard, economy"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value)
                    setCodeTouched(true)
                  }}
                  required
                />
              </div>

              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  Description <span className="text-ui-fg-subtle font-normal">(optional)</span>
                </Label>
                <Input
                  placeholder="Short description of this option type"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </Drawer.Body>

            <Drawer.Footer className="flex items-center justify-end gap-x-2 border-t p-6">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCreateOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={createMutation.isPending}>
                Create Type
              </Button>
            </Drawer.Footer>
          </form>
        </Drawer.Content>
      </Drawer>

      {/* Edit Drawer */}
      <Drawer open={editOpen} onOpenChange={setEditOpen}>
        <Drawer.Content className="max-w-md">
          <Drawer.Header>
            <Drawer.Title asChild>
              <Heading level="h2">Edit Shipping Option Type</Heading>
            </Drawer.Title>
            <Drawer.Description className="text-ui-fg-subtle text-sm">
              Update shipping option type details.
            </Drawer.Description>
          </Drawer.Header>

          <form onSubmit={handleEditSubmit} className="flex flex-1 flex-col justify-between">
            <Drawer.Body className="flex flex-col gap-y-4 p-6">
              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  Label <span className="text-ui-fg-error">*</span>
                </Label>
                <Input
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  Code <span className="text-ui-fg-error">*</span>
                </Label>
                <Input
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  Description <span className="text-ui-fg-subtle font-normal">(optional)</span>
                </Label>
                <Input
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </div>
            </Drawer.Body>

            <Drawer.Footer className="flex items-center justify-end gap-x-2 border-t p-6">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditOpen(false)}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={updateMutation.isPending}>
                Save Changes
              </Button>
            </Drawer.Footer>
          </form>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}
