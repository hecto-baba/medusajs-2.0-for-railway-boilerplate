"use client"

import { getVendorProduct } from "@lib/data/vendor-client"
import {
  useBreadcrumbTitle,
  LayoutComposer,
  CUSTOMIZE_IDS,
  CORE_LAYOUT_IDS,
} from "@modules/layout"
import { Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { AttributesSection, GeneralSection } from "./general-section"
import { OrganizeSection } from "./organize-section"
import {
  SalesChannelSection,
  ShippingSection,
} from "./sales-channel-section"
import { MediaSection } from "./media-section"
import { JsonSection, MetadataSection } from "./metadata-section"
import { OptionsSection } from "./options-section"
import { RentalSection } from "./rental-section"
import { VariantsSection } from "./variants-section"

/**
 * The product detail screen, composed the way the admin composes its own:
 * General, Media, Options and Variants down the main column, with Sales
 * Channels, Organize and Attributes in the sidebar.
 */
export const ProductDetail = ({ id }: { id: string }) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["vendor-product", id],
    queryFn: () => getVendorProduct(id),
    retry: false,
  })

  useBreadcrumbTitle(data?.product?.title)

  if (isLoading) {
    return <Text className="text-ui-fg-subtle">Loading…</Text>
  }

  if (error || !data?.product) {
    return (
      <Text className="text-ui-fg-error">
        {error instanceof Error ? error.message : "Product not found."}
      </Text>
    )
  }

  const product = data.product

  return (
    <LayoutComposer
      widgetsZonePrefix="product.details"
      preferredLayoutId={CORE_LAYOUT_IDS.TWO_COLUMN}
      customizeId={CUSTOMIZE_IDS.PAGE}
      sections={{
        main: (
          <>
            <LayoutComposer.Entry id="ProductGeneralSection">
              <GeneralSection product={product} />
            </LayoutComposer.Entry>
            <LayoutComposer.Entry id="ProductMediaSection">
              <MediaSection product={product} />
            </LayoutComposer.Entry>
            <LayoutComposer.Entry id="ProductOptionSection">
              <OptionsSection product={product} />
            </LayoutComposer.Entry>
            <LayoutComposer.Entry id="ProductVariantSection">
              <VariantsSection product={product} />
            </LayoutComposer.Entry>
            <LayoutComposer.Entry id="ProductMetadataSection">
              <MetadataSection product={product} />
            </LayoutComposer.Entry>
            <LayoutComposer.Entry id="ProductJsonSection">
              <JsonSection product={product} />
            </LayoutComposer.Entry>
            <LayoutComposer.Entry id="ProductRentalSection">
              <RentalSection product={product} />
            </LayoutComposer.Entry>
          </>
        ),
        side: (
          <>
            <LayoutComposer.Entry id="ProductSalesChannelSection">
              <SalesChannelSection product={product} />
            </LayoutComposer.Entry>
            <LayoutComposer.Entry id="ProductShippingSection">
              <ShippingSection product={product} />
            </LayoutComposer.Entry>
            <LayoutComposer.Entry id="ProductOrganizeSection">
              <OrganizeSection product={product} />
            </LayoutComposer.Entry>
            <LayoutComposer.Entry id="ProductAttributesSection">
              <AttributesSection product={product} />
            </LayoutComposer.Entry>
          </>
        ),
      }}
    />
  )
}
