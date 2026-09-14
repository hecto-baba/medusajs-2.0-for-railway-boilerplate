"use client"

import { listVendorProducts } from "@lib/data/vendor-client"
import { Checkbox, Input, Label, Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"

type PromotionProductRulesProps = {
  label: string
  hint?: string
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

/**
 * Replaces the admin's generic rule builder (attribute dropdown + operator +
 * async value combobox, resolved from three chained metadata endpoints) with
 * a single fixed picker: "product" is the only attribute a vendor is allowed
 * to scope a promotion by (see backend/src/api/vendors/promotions/helpers.ts),
 * so there is nothing left to choose except which of the vendor's own
 * products the rule should list.
 *
 * Only the vendor's own catalogue is ever fetched - listVendorProducts is
 * already scoped server-side - so this can never surface another vendor's
 * product regardless of what the checkbox list renders.
 */
export const PromotionProductRules = ({
  label,
  hint,
  selectedIds,
  onChange,
}: PromotionProductRulesProps) => {
  const [search, setSearch] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-products-picker", search],
    queryFn: () =>
      listVendorProducts({ limit: 20, offset: 0, q: search || undefined }),
    placeholderData: (previous) => previous,
  })

  const products = data?.products ?? []

  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((existing) => existing !== id)
        : [...selectedIds, id]
    )
  }

  return (
    <div className="flex flex-col gap-y-2">
      <Label size="small" weight="plus">
        {label}
      </Label>
      {hint ? (
        <Text size="small" className="text-ui-fg-subtle">
          {hint}
        </Text>
      ) : null}

      <Input
        placeholder="Search your products..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      <div className="border-ui-border-base flex max-h-56 flex-col gap-y-1 overflow-y-auto rounded-md border p-2">
        {isLoading ? (
          <Text size="small" className="text-ui-fg-subtle p-2">
            Loading…
          </Text>
        ) : products.length ? (
          products.map((product) => (
            <label
              key={product.id}
              className="hover:bg-ui-bg-base-hover flex items-center gap-x-2 rounded-md px-2 py-1.5"
            >
              <Checkbox
                checked={selectedIds.includes(product.id)}
                onCheckedChange={() => toggle(product.id)}
              />
              <Text size="small" className="truncate">
                {product.title}
              </Text>
            </label>
          ))
        ) : (
          <Text size="small" className="text-ui-fg-subtle p-2">
            No products match that search.
          </Text>
        )}
      </div>

      {selectedIds.length > 0 && (
        <Text size="small" className="text-ui-fg-subtle">
          {selectedIds.length}{" "}
          {selectedIds.length === 1 ? "product" : "products"} selected.
        </Text>
      )}
    </div>
  )
}
