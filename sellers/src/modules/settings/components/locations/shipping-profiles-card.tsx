"use client"

import {
  createVendorShippingProfile,
  deleteVendorShippingProfile,
  listVendorShippingProfiles,
  type VendorShippingProfile,
} from "@lib/data/vendor-client"
import { Buildings, PlusMini, Trash } from "@medusajs/icons"
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
  RadioGroup,
  Text,
  toast,
  useDataTable,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useMemo, useState } from "react"

const columnHelper = createDataTableColumnHelper<VendorShippingProfile>()
const filterHelper = createDataTableFilterHelper<VendorShippingProfile>()

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
    id: "name",
    label: "Name",
    type: "string",
  }),
  filterHelper.custom({
    id: "type",
    label: "Type",
    type: "select",
    options: [
      { label: "Default", value: "default" },
      { label: "Custom", value: "custom" },
      { label: "Gift Card", value: "gift_card" },
    ],
  }),
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

export const ShippingProfilesCard = () => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [type, setType] = useState("default")
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

  const nameVal = extractFilterValue(filtering.name)
  const typeVal = extractFilterValue(filtering.type)
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
      "vendor-shipping-profiles",
      limit,
      offset,
      search,
      nameVal,
      typeVal,
      createdAtGte,
      updatedAtGte,
      order,
    ],
    queryFn: () =>
      listVendorShippingProfiles({
        limit,
        offset,
        q: search || undefined,
        name: nameVal,
        type: typeVal,
        created_at_gte: createdAtGte,
        updated_at_gte: updatedAtGte,
        order,
      }),
    placeholderData: (previous) => previous,
  })

  const { mutateAsync: removeProfile } = useMutation({
    mutationFn: (id: string) => deleteVendorShippingProfile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-shipping-profiles"] })
    },
  })

  const handleDelete = useCallback(
    async (profile: VendorShippingProfile) => {
      const confirmed = await prompt({
        title: "Delete shipping profile",
        description: `Are you sure you want to delete "${profile.name}"? This cannot be undone.`,
        confirmText: "Delete",
        cancelText: "Cancel",
        variant: "danger",
      })

      if (!confirmed) {
        return
      }

      try {
        await removeProfile(profile.id)
        toast.success(`Shipping profile "${profile.name}" was deleted.`)
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not delete shipping profile."
        )
      }
    },
    [prompt, removeProfile]
  )

  const createMutation = useMutation({
    mutationFn: () =>
      createVendorShippingProfile({
        name: name.trim(),
        type,
      }),
    onSuccess: () => {
      toast.success("Shipping profile created")
      queryClient.invalidateQueries({ queryKey: ["vendor-shipping-profiles"] })
      setCreateOpen(false)
      setName("")
      setType("default")
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create shipping profile")
    },
  })

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error("Profile name is required")
      return
    }
    createMutation.mutate()
  }

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        id: "name",
        header: "Name",
        enableSorting: true,
        sortLabel: "Name",
        sortAscLabel: "Ascending",
        sortDescLabel: "Descending",
        cell: ({ row }) => (
          <div className="flex items-center gap-x-2">
            <Buildings className="text-ui-fg-subtle shrink-0" />
            <Text size="small" weight="plus" className="text-ui-fg-base">
              {row.original.name}
            </Text>
          </div>
        ),
      }),
      columnHelper.accessor("type", {
        id: "type",
        header: "Type",
        enableSorting: true,
        sortLabel: "Type",
        sortAscLabel: "Ascending",
        sortDescLabel: "Descending",
        cell: ({ row }) => {
          const t = row.original.type
          const label =
            t === "gift_card"
              ? "Gift Card"
              : t === "custom"
              ? "Custom"
              : "Default"
          const color =
            t === "gift_card"
              ? "purple"
              : t === "custom"
              ? "blue"
              : "grey"
          return (
            <Badge size="small" color={color}>
              {label}
            </Badge>
          )
        },
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
    data: data?.shipping_profiles ?? [],
    rowCount: data?.count ?? data?.shipping_profiles?.length ?? 0,
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
              <Heading level="h2">Shipping Profiles</Heading>
              <Text size="small" className="text-ui-fg-subtle">
                Manage shipping profiles to differentiate shipping rates for special products.
              </Text>
            </div>
            <Button
              size="small"
              variant="secondary"
              onClick={() => setCreateOpen(true)}
            >
              <PlusMini />
              Create Profile
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
              heading: "No shipping profiles",
              description: "Create a shipping profile to get started.",
            },
            filtered: {
              heading: "No results found",
              description: "Try changing your search or filter options.",
            },
          }}
        />

        <DataTable.Pagination />
      </DataTable>

      <Drawer open={createOpen} onOpenChange={setCreateOpen}>
        <Drawer.Content className="max-w-md">
          <Drawer.Header>
            <Drawer.Title asChild>
              <Heading level="h2">Create Shipping Profile</Heading>
            </Drawer.Title>
            <Drawer.Description className="text-ui-fg-subtle text-sm">
              Define shipping conditions and rates for specific product types.
            </Drawer.Description>
          </Drawer.Header>

          <form onSubmit={handleCreateSubmit} className="flex flex-1 flex-col justify-between">
            <Drawer.Body className="flex flex-col gap-y-4 p-6">
              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  Profile Name <span className="text-ui-fg-error">*</span>
                </Label>
                <Input
                  placeholder="e.g. Fragile, Oversized, Standard"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus">
                  Profile Type
                </Label>
                <RadioGroup value={type} onValueChange={setType} className="flex flex-col gap-y-2">
                  <div className="flex items-center gap-x-2">
                    <RadioGroup.Item value="default" id="type-default" />
                    <Label htmlFor="type-default" size="small">
                      Default Profile
                    </Label>
                  </div>
                  <div className="flex items-center gap-x-2">
                    <RadioGroup.Item value="custom" id="type-custom" />
                    <Label htmlFor="type-custom" size="small">
                      Custom Profile
                    </Label>
                  </div>
                  <div className="flex items-center gap-x-2">
                    <RadioGroup.Item value="gift_card" id="type-gift-card" />
                    <Label htmlFor="type-gift-card" size="small">
                      Gift Card Profile
                    </Label>
                  </div>
                </RadioGroup>
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
                Create Profile
              </Button>
            </Drawer.Footer>
          </form>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}
