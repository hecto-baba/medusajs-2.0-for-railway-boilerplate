"use client"

import {
  listVendorProducts,
  manageVendorSalesChannelProducts,
  type VendorProduct,
} from "@lib/data/vendor-client"
import {
  Button,
  Checkbox,
  FocusModal,
  Heading,
  Input,
  StatusBadge,
  Text,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

type SalesChannelAddProductsModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  salesChannelId: string
  existingProductIds: string[]
  onSuccess?: () => void
}

export const SalesChannelAddProductsModal = ({
  open,
  onOpenChange,
  salesChannelId,
  existingProductIds,
  onSuccess,
}: SalesChannelAddProductsModalProps) => {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-products-for-sc", search],
    queryFn: () => listVendorProducts({ limit: 50, offset: 0, q: search || undefined }),
    enabled: open,
  })

  const availableProducts = (data?.products ?? []).filter(
    (p) => !existingProductIds.includes(p.id)
  )

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === availableProducts.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(availableProducts.map((p) => p.id))
    }
  }

  const addMutation = useMutation({
    mutationFn: () =>
      manageVendorSalesChannelProducts(salesChannelId, {
        add: selectedIds,
      }),
    onSuccess: () => {
      toast.success(`Added ${selectedIds.length} product(s) to sales channel`)
      queryClient.invalidateQueries({
        queryKey: ["vendor-sales-channel", salesChannelId],
      })
      queryClient.invalidateQueries({
        queryKey: ["vendor-sales-channels"],
      })
      onOpenChange(false)
      setSelectedIds([])
      onSuccess?.()
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to add products")
    },
  })

  return (
    <FocusModal open={open} onOpenChange={onOpenChange}>
      <FocusModal.Content className="flex flex-col">
        <FocusModal.Header className="flex items-center justify-between border-b p-4">
          <div>
            <FocusModal.Title asChild>
              <Heading level="h2">Add Products to Sales Channel</Heading>
            </FocusModal.Title>
            <FocusModal.Description className="text-ui-fg-subtle text-sm">
              Select products from your catalog to make available in this sales channel.
            </FocusModal.Description>
          </div>
          <div className="flex items-center gap-x-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={selectedIds.length === 0}
              isLoading={addMutation.isPending}
              onClick={() => addMutation.mutate()}
            >
              Add {selectedIds.length > 0 ? `(${selectedIds.length})` : ""} Products
            </Button>
          </div>
        </FocusModal.Header>

        <FocusModal.Body className="flex flex-1 flex-col gap-y-4 p-6 max-w-2xl mx-auto w-full overflow-hidden">
          <Input
            type="search"
            placeholder="Search products by title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="flex-1 overflow-y-auto rounded-lg border divide-y">
            <div className="flex items-center justify-between p-3 bg-ui-bg-subtle text-sm font-medium">
              <div className="flex items-center gap-x-3">
                <Checkbox
                  checked={
                    availableProducts.length > 0 &&
                    selectedIds.length === availableProducts.length
                  }
                  onCheckedChange={toggleSelectAll}
                />
                <Text size="small" weight="plus">
                  Product
                </Text>
              </div>
              <Text size="small" weight="plus" className="text-ui-fg-subtle">
                Status
              </Text>
            </div>

            {isLoading ? (
              <div className="p-8 text-center">
                <Text size="small" className="text-ui-fg-subtle">
                  Loading products...
                </Text>
              </div>
            ) : availableProducts.length === 0 ? (
              <div className="p-8 text-center">
                <Text size="small" className="text-ui-fg-subtle">
                  No eligible products found. All products may already be in this channel.
                </Text>
              </div>
            ) : (
              availableProducts.map((p) => {
                const isChecked = selectedIds.includes(p.id)
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 hover:bg-ui-bg-subtle-hover cursor-pointer"
                    onClick={() => toggleSelect(p.id)}
                  >
                    <div className="flex items-center gap-x-3">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleSelect(p.id)}
                      />
                      <div className="flex flex-col">
                        <Text size="small" weight="plus" className="text-ui-fg-base">
                          {p.title}
                        </Text>
                        <Text size="xsmall" className="text-ui-fg-subtle">
                          {p.variants?.length || 0} variant(s)
                        </Text>
                      </div>
                    </div>
                    <StatusBadge
                      color={p.status === "published" ? "green" : "grey"}
                    >
                      {p.status}
                    </StatusBadge>
                  </div>
                )
              })
            )}
          </div>
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  )
}
