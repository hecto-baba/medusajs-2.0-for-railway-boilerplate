"use client"

import {
  removeProductsFromPriceList,
  type VendorPriceList,
  type VendorPriceListProduct,
} from "@lib/data/vendor-client"
import { ActionMenu, Thumbnail } from "@modules/common"
import { PencilSquare, Plus, Trash } from "@medusajs/icons"
import {
  Badge,
  Checkbox,
  CommandBar,
  Container,
  createDataTableColumnHelper,
  DataTable,
  Heading,
  Text,
  toast,
  useDataTable,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useMemo, useState } from "react"
import { PriceListPricesAddModal } from "../forms/price-list-prices-add-modal"
import { PriceListPricesEditModal } from "../forms/price-list-prices-edit-modal"

type ProductsSectionProps = {
  priceList: VendorPriceList
}

const columnHelper = createDataTableColumnHelper<VendorPriceListProduct>()

export const ProductsSection = ({ priceList }: ProductsSectionProps) => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [filterEditProductIds, setFilterEditProductIds] = useState<string[] | undefined>(undefined)

  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])

  const products = priceList.products ?? []

  const removeMutation = useMutation({
    mutationFn: (productIds: string[]) =>
      removeProductsFromPriceList(priceList.id, productIds),
    onSuccess: (_, variables) => {
      const count = variables.length
      toast.success(
        count === 1
          ? "Successfully deleted prices for 1 product."
          : `Successfully deleted prices for ${count} products.`
      )
      setSelectedProductIds([])
      queryClient.invalidateQueries({
        queryKey: ["vendor-price-list", priceList.id],
      })
      queryClient.invalidateQueries({
        queryKey: ["vendor-price-lists"],
      })
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to remove products")
    },
  })

  const handleSingleDelete = async (product: VendorPriceListProduct) => {
    const res = await prompt({
      title: "Are you sure?",
      description: "You are about to delete the prices for 1 product in the price list. This action cannot be undone.",
      confirmText: "Delete",
      cancelText: "Cancel",
    })

    if (res) {
      removeMutation.mutate([product.id])
    }
  }

  const handleBatchDelete = async () => {
    if (!selectedProductIds.length) return

    const count = selectedProductIds.length
    const res = await prompt({
      title: "Are you sure?",
      description: `You are about to delete the prices for ${count} ${
        count === 1 ? "product" : "products"
      } in the price list. This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
    })

    if (res) {
      removeMutation.mutate(selectedProductIds)
    }
  }

  const handleOpenEditForIds = (ids?: string[]) => {
    setFilterEditProductIds(ids)
    setIsEditModalOpen(true)
  }

  const handleToggleProduct = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProductIds(products.map((p) => p.id))
    } else {
      setSelectedProductIds([])
    }
  }

  const allSelected =
    products.length > 0 && products.every((p) => selectedProductIds.includes(p.id))
  const someSelected =
    products.some((p) => selectedProductIds.includes(p.id)) && !allSelected

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "select",
        header: () => (
          <Checkbox
            checked={
              allSelected ? true : someSelected ? "indeterminate" : false
            }
            onCheckedChange={(checked) => handleSelectAll(!!checked)}
          />
        ),
        cell: ({ row }) => {
          const product = row.original
          const isSelected = selectedProductIds.includes(product.id)
          return (
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => handleToggleProduct(product.id)}
              onClick={(e) => e.stopPropagation()}
            />
          )
        },
      }),
      columnHelper.display({
        id: "product",
        header: "Product",
        cell: ({ row }) => {
          const prod = row.original
          return (
            <Link
              href={`/products/${prod.id}`}
              className="flex items-center gap-x-3 group"
            >
              <Thumbnail src={prod.thumbnail} />
              <div className="flex flex-col">
                <Text
                  size="small"
                  weight="plus"
                  className="group-hover:text-ui-fg-interactive transition-colors"
                >
                  {prod.title}
                </Text>
              </div>
            </Link>
          )
        },
      }),
      columnHelper.accessor("variants", {
        header: "Variants",
        cell: ({ getValue }) => {
          const count = getValue()?.length ?? 0
          return (
            <Text size="small" className="text-ui-fg-subtle">
              {count} {count === 1 ? "variant" : "variants"}
            </Text>
          )
        },
      }),
      columnHelper.display({
        id: "prices_count",
        header: "Prices",
        cell: ({ row }) => {
          const totalPrices = row.original.variants.reduce(
            (sum, v) => sum + (v.prices?.length ?? 0),
            0
          )
          return (
            <Badge size="small" color="blue">
              {totalPrices} {totalPrices === 1 ? "price" : "prices"}
            </Badge>
          )
        },
      }),
      columnHelper.display({
        id: "actions",
        cell: ({ row }) => {
          const product = row.original
          return (
            <ActionMenu
              groups={[
                {
                  actions: [
                    {
                      label: "Edit prices",
                      icon: <PencilSquare />,
                      onClick: () => handleOpenEditForIds([product.id]),
                    },
                  ],
                },
                {
                  actions: [
                    {
                      label: "Remove",
                      icon: <Trash />,
                      onClick: () => handleSingleDelete(product),
                    },
                  ],
                },
              ]}
            />
          )
        },
      }),
    ],
    [selectedProductIds, products, allSelected, someSelected]
  )

  const table = useDataTable({
    data: products,
    columns,
    rowCount: products.length,
    getRowId: (row) => row.id,
  })

  return (
    <>
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h2">Products</Heading>
          <ActionMenu
            groups={[
              {
                actions: [
                  {
                    label: "Add products",
                    icon: <Plus />,
                    onClick: () => setIsAddModalOpen(true),
                  },
                  {
                    label: "Edit prices",
                    icon: <PencilSquare />,
                    onClick: () => handleOpenEditForIds(undefined),
                  },
                ],
              },
            ]}
          />
        </div>

        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Heading level="h3" className="text-ui-fg-base">
              No products added
            </Heading>
            <Text size="small" className="text-ui-fg-subtle max-w-sm mt-1 mb-4">
              Add products to this price list to configure sale or override prices.
            </Text>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="txt-compact-small text-ui-fg-interactive hover:underline font-medium"
            >
              Add products
            </button>
          </div>
        ) : (
          <DataTable instance={table}>
            <DataTable.Table />
          </DataTable>
        )}

        {/* Command Bar when rows selected */}
        <CommandBar open={selectedProductIds.length > 0}>
          <CommandBar.Bar>
            <CommandBar.Value>
              {selectedProductIds.length} selected
            </CommandBar.Value>
            <CommandBar.Seperator />
            <CommandBar.Command
              action={() => handleOpenEditForIds(selectedProductIds)}
              label="Edit prices"
              shortcut="e"
            />
            <CommandBar.Seperator />
            <CommandBar.Command
              action={handleBatchDelete}
              label="Delete"
              shortcut="d"
            />
          </CommandBar.Bar>
        </CommandBar>
      </Container>

      {/* Add Products Modal */}
      <PriceListPricesAddModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        priceList={priceList}
      />

      {/* Edit Prices Modal */}
      <PriceListPricesEditModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        priceList={priceList}
        filterProductIds={filterEditProductIds}
      />
    </>
  )
}
