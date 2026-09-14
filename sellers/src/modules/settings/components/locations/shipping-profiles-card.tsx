"use client"

import {
  createVendorShippingProfile,
  listVendorShippingProfiles,
  type VendorShippingProfile,
} from "@lib/data/vendor-client"
import { Buildings, PlusMini } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  createDataTableColumnHelper,
  DataTable,
  Drawer,
  Heading,
  Input,
  Label,
  RadioGroup,
  Text,
  toast,
  useDataTable,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

const columnHelper = createDataTableColumnHelper<VendorShippingProfile>()

export const ShippingProfilesCard = () => {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [type, setType] = useState("default")

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-shipping-profiles"],
    queryFn: () => listVendorShippingProfiles(),
  })

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

  const columns = [
    columnHelper.accessor("name", {
      header: "Name",
      cell: ({ row }) => (
        <div className="flex items-center gap-x-2">
          <Buildings className="text-ui-fg-subtle" />
          <Text size="small" weight="plus" className="text-ui-fg-base">
            {row.original.name}
          </Text>
        </div>
      ),
    }),
    columnHelper.accessor("type", {
      header: "Type",
      cell: ({ row }) => (
        <Badge size="small" color={row.original.type === "gift_card" ? "purple" : "grey"}>
          {row.original.type === "gift_card" ? "Gift Card" : "Default"}
        </Badge>
      ),
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
  ]

  const table = useDataTable({
    columns,
    data: data?.shipping_profiles ?? [],
    rowCount: data?.shipping_profiles?.length ?? 0,
    getRowId: (row) => row.id,
    isLoading,
  })

  return (
    <Container className="p-0">
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex items-center justify-between gap-x-2 px-6 py-4">
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
        </DataTable.Toolbar>
        <DataTable.Table />
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
