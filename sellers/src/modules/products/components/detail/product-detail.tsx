"use client"

import { getVendorProduct } from "@lib/data/vendor-client"
import { useBreadcrumbTitle } from "@modules/layout"
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
 *
 * Fetched client-side so the request carries the session cookie through the
 * /api/vendors proxy, and so a product belonging to another vendor surfaces
 * here as an error state rather than a server-rendered exception.
 */
export const ProductDetail = ({ id }: { id: string }) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["vendor-product", id],
    queryFn: () => getVendorProduct(id),
    retry: false,
  })

  // Hooks cannot run after an early return, so this sits above the loading and
  // error branches and simply registers nothing until the product arrives.
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
    <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
      <div className="flex w-full flex-col gap-6 xl:max-w-4xl">
        <GeneralSection product={product} />
        <MediaSection product={product} />
        <OptionsSection product={product} />
        <VariantsSection product={product} />
        <MetadataSection product={product} />
        <JsonSection product={product} />
        <RentalSection product={product} />
      </div>
      <div className="flex w-full flex-col gap-6 xl:max-w-sm">
        <SalesChannelSection product={product} />
        <ShippingSection product={product} />
        <OrganizeSection product={product} />
        <AttributesSection product={product} />
      </div>
    </div>
  )
}
