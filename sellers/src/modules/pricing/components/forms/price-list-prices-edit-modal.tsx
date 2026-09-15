"use client"

import {
  batchVendorPriceListPrices,
  type VendorPriceList,
  type VendorPriceListProduct,
} from "@lib/data/vendor-client"
import { Thumbnail } from "@modules/common"
import {
  Badge,
  Button,
  FocusModal,
  Heading,
  Input,
  Table,
  Text,
  toast,
} from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"

type PriceListPricesEditModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  priceList: VendorPriceList
  filterProductIds?: string[]
  onSuccess?: () => void
}

type EditPriceRow = {
  price_id?: string
  variant_id: string
  variant_title: string
  product_id: string
  product_title: string
  currency_code: string
  amount: string
  min_quantity?: string
  max_quantity?: string
}

export const PriceListPricesEditModal = ({
  open,
  onOpenChange,
  priceList,
  filterProductIds,
  onSuccess,
}: PriceListPricesEditModalProps) => {
  const queryClient = useQueryClient()

  const [editRows, setEditRows] = useState<Record<string, EditPriceRow>>({})

  const allProducts = priceList.products ?? []
  const productsToEdit = filterProductIds?.length
    ? allProducts.filter((p) => filterProductIds.includes(p.id))
    : allProducts

  useEffect(() => {
    if (priceList && open) {
      const initial: Record<string, EditPriceRow> = {}

      for (const prod of productsToEdit) {
        for (const variant of prod.variants ?? []) {
          if (variant.prices?.length) {
            for (const p of variant.prices) {
              const key = p.id || `${variant.id}-${p.currency_code}`
              initial[key] = {
                price_id: p.id,
                variant_id: variant.id,
                variant_title: variant.title || "Default Variant",
                product_id: prod.id,
                product_title: prod.title,
                currency_code: p.currency_code,
                amount: (p.amount / 100).toFixed(2),
                min_quantity: p.min_quantity != null ? String(p.min_quantity) : "",
                max_quantity: p.max_quantity != null ? String(p.max_quantity) : "",
              }
            }
          } else {
            // Variant without price yet
            const key = `new-${variant.id}`
            initial[key] = {
              variant_id: variant.id,
              variant_title: variant.title || "Default Variant",
              product_id: prod.id,
              product_title: prod.title,
              currency_code: "usd",
              amount: "",
            }
          }
        }
      }

      setEditRows(initial)
    }
  }, [priceList, filterProductIds, open])

  const batchMutation = useMutation({
    mutationFn: (body: { create?: any[]; update?: any[]; delete?: string[] }) =>
      batchVendorPriceListPrices(priceList.id, body),
    onSuccess: () => {
      toast.success("Prices were successfully updated.")
      queryClient.invalidateQueries({
        queryKey: ["vendor-price-list", priceList.id],
      })
      queryClient.invalidateQueries({ queryKey: ["vendor-price-lists"] })
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update prices")
    },
  })

  const handleFieldChange = (
    key: string,
    field: keyof EditPriceRow,
    val: string
  ) => {
    setEditRows((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: val,
      },
    }))
  }

  const handleSubmit = () => {
    const toCreate: any[] = []
    const toUpdate: any[] = []
    const toDelete: string[] = []

    for (const [key, row] of Object.entries(editRows)) {
      if (row.price_id) {
        if (!row.amount || isNaN(Number(row.amount))) {
          // If amount cleared, delete price
          toDelete.push(row.price_id)
        } else {
          toUpdate.push({
            id: row.price_id,
            variant_id: row.variant_id,
            currency_code: row.currency_code.toLowerCase(),
            amount: Math.round(Number(row.amount) * 100),
            min_quantity: row.min_quantity ? Number(row.min_quantity) : null,
            max_quantity: row.max_quantity ? Number(row.max_quantity) : null,
          })
        }
      } else if (row.amount && !isNaN(Number(row.amount))) {
        toCreate.push({
          variant_id: row.variant_id,
          currency_code: row.currency_code.toLowerCase(),
          amount: Math.round(Number(row.amount) * 100),
          min_quantity: row.min_quantity ? Number(row.min_quantity) : null,
          max_quantity: row.max_quantity ? Number(row.max_quantity) : null,
        })
      }
    }

    batchMutation.mutate({
      create: toCreate.length ? toCreate : undefined,
      update: toUpdate.length ? toUpdate : undefined,
      delete: toDelete.length ? toDelete : undefined,
    })
  }

  return (
    <FocusModal open={open} onOpenChange={onOpenChange}>
      <FocusModal.Content className="flex flex-col overflow-hidden">
        <FocusModal.Header className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <FocusModal.Title asChild>
              <Heading level="h2">Edit Prices</Heading>
            </FocusModal.Title>
            <FocusModal.Description asChild>
              <Text size="small" className="text-ui-fg-subtle">
                Manage conditional prices and currency overrides for &ldquo;{priceList.title}&rdquo;.
              </Text>
            </FocusModal.Description>
          </div>

          <div className="flex items-center gap-x-2">
            <Button
              variant="secondary"
              size="small"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="small"
              onClick={handleSubmit}
              isLoading={batchMutation.isPending}
            >
              Save
            </Button>
          </div>
        </FocusModal.Header>

        <FocusModal.Body className="size-full overflow-y-auto p-6">
          {productsToEdit.length === 0 ? (
            <div className="border rounded-lg p-12 text-center bg-ui-bg-subtle">
              <Text size="small" className="text-ui-fg-subtle">
                No products to edit.
              </Text>
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto divide-y">
              {productsToEdit.map((product) => (
                <div key={product.id} className="flex flex-col">
                  <div className="flex items-center gap-x-3 p-3 bg-ui-bg-subtle/50">
                    <Thumbnail src={product.thumbnail} />
                    <Text size="small" weight="plus">
                      {product.title}
                    </Text>
                  </div>

                  <Table>
                    <Table.Header>
                      <Table.Row>
                        <Table.HeaderCell>Variant</Table.HeaderCell>
                        <Table.HeaderCell>SKU</Table.HeaderCell>
                        <Table.HeaderCell className="w-32">Currency</Table.HeaderCell>
                        <Table.HeaderCell className="w-40">Price</Table.HeaderCell>
                        <Table.HeaderCell className="w-28">Min Qty</Table.HeaderCell>
                        <Table.HeaderCell className="w-28">Max Qty</Table.HeaderCell>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {Object.entries(editRows)
                        .filter(([_, r]) => r.product_id === product.id)
                        .map(([key, row]) => (
                          <Table.Row key={key}>
                            <Table.Cell className="font-medium text-ui-fg-base text-sm">
                              {row.variant_title}
                            </Table.Cell>
                            <Table.Cell className="text-ui-fg-subtle text-xs">
                              {product.variants.find((v) => v.id === row.variant_id)?.sku || "-"}
                            </Table.Cell>
                            <Table.Cell>
                              <Badge size="small" className="uppercase font-mono">
                                {row.currency_code.toUpperCase()}
                              </Badge>
                            </Table.Cell>
                            <Table.Cell>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={row.amount}
                                onChange={(e) =>
                                  handleFieldChange(key, "amount", e.target.value)
                                }
                              />
                            </Table.Cell>
                            <Table.Cell>
                              <Input
                                type="number"
                                min={1}
                                placeholder="-"
                                value={row.min_quantity || ""}
                                onChange={(e) =>
                                  handleFieldChange(
                                    key,
                                    "min_quantity",
                                    e.target.value
                                  )
                                }
                              />
                            </Table.Cell>
                            <Table.Cell>
                              <Input
                                type="number"
                                min={1}
                                placeholder="-"
                                value={row.max_quantity || ""}
                                onChange={(e) =>
                                  handleFieldChange(
                                    key,
                                    "max_quantity",
                                    e.target.value
                                  )
                                }
                              />
                            </Table.Cell>
                          </Table.Row>
                        ))}
                    </Table.Body>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  )
}
