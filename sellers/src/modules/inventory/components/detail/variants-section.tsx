"use client"

import { type VendorInventoryItem } from "@lib/data/vendor-client"
import { Thumbnail } from "@modules/common"
import { Container, Heading, Text } from "@medusajs/ui"
import Link from "next/link"

export const VariantsSection = ({ item }: { item: VendorInventoryItem }) => {
  const variants = item.variants ?? []

  return (
    <Container className="p-6">
      <div className="mb-4">
        <Heading level="h2">Linked Variants</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Product variants that consume stock from this inventory item.
        </Text>
      </div>

      {variants.length === 0 ? (
        <div className="border-ui-border-base bg-ui-bg-subtle flex flex-col items-center justify-center rounded-lg border py-6 text-center">
          <Text size="small" className="text-ui-fg-subtle">
            No product variants currently linked.
          </Text>
        </div>
      ) : (
        <div className="flex flex-col gap-y-3">
          {variants.map((variant) => {
            const product = variant.product
            const productTitle = product?.title || "Product"
            const variantTitle = variant.title || "Default Variant"
            const productId = product?.id

            return (
              <div
                key={variant.id}
                className="border-ui-border-base hover:bg-ui-bg-base-hover flex items-center justify-between rounded-lg border p-3 transition-colors"
              >
                <div className="flex items-center gap-x-3">
                  <Thumbnail src={product?.thumbnail} />
                  <div className="flex flex-col">
                    <Text size="small" weight="plus">
                      {productTitle}
                    </Text>
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      Variant: {variantTitle}
                      {variant.sku ? ` (${variant.sku})` : ""}
                    </Text>
                  </div>
                </div>

                {productId && (
                  <ButtonLink href={`/products/${productId}`}>
                    View Product
                  </ButtonLink>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Container>
  )
}

const ButtonLink = ({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) => (
  <Link
    href={href}
    className="border-ui-border-base bg-ui-button-secondary hover:bg-ui-button-secondary-hover text-ui-fg-base txt-compact-small-plus rounded-md border px-2.5 py-1 transition-colors"
  >
    {children}
  </Link>
)
