"use client"

import { type VendorInventoryItem } from "@lib/data/vendor-client"
import { Thumbnail } from "@modules/common"
import { Container, Heading } from "@medusajs/ui"
import { TriangleRightMini } from "@medusajs/icons"
import Link from "next/link"

export const VariantsSection = ({ item }: { item: VendorInventoryItem }) => {
  const variants = item.variants ?? []

  if (!variants.length) {
    return null
  }

  return (
    <Container className="p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Associated variants</Heading>
      </div>

      <div className="txt-small flex flex-col gap-2 px-2 pb-2">
        {variants.map((variant) => {
          const link = variant.product
            ? `/products/${variant.product.id}`
            : null

          const optionsString = variant.options
            ? (variant.options as any[]).map((o) => o.value || o).join(" ⋅ ")
            : variant.sku || ""

          const Inner = (
            <div className="shadow-elevation-card-rest bg-ui-bg-component hover:bg-ui-bg-component-hover rounded-md px-4 py-2 transition-colors">
              <div className="flex items-center gap-3">
                <div className="shadow-elevation-card-rest rounded-md">
                  <Thumbnail src={variant.product?.thumbnail} />
                </div>
                <div className="flex flex-1 flex-col">
                  <span className="text-ui-fg-base font-medium">
                    {variant.title || "Default Variant"}
                  </span>
                  {optionsString && (
                    <span className="text-ui-fg-subtle text-xs">
                      {optionsString}
                    </span>
                  )}
                </div>
                <div className="flex size-7 items-center justify-center">
                  <TriangleRightMini className="text-ui-fg-muted rtl:rotate-180" />
                </div>
              </div>
            </div>
          )

          if (!link) {
            return <div key={variant.id}>{Inner}</div>
          }

          return (
            <Link
              href={link}
              key={variant.id}
              className="focus-within:shadow-borders-interactive-with-focus rounded-md outline-none"
            >
              {Inner}
            </Link>
          )
        })}
      </div>
    </Container>
  )
}
