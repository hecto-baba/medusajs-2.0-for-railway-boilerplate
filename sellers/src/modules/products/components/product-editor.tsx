"use client"

import { getVendorProduct } from "@lib/data/vendor-client"
import { useBreadcrumbTitle } from "@modules/layout"
import { Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { ProductForm } from "./product-form"

/**
 * Loads one product client-side before handing it to the shared form.
 *
 * Fetched here rather than in the page so the request carries the session
 * cookie through the same /api/vendors proxy the rest of the panel uses -
 * and so a product belonging to another vendor surfaces as this component's
 * error state rather than a server-rendered exception.
 */
export const ProductEditor = ({ id }: { id: string }) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["vendor-product", id],
    queryFn: () => getVendorProduct(id),
    retry: false,
  })

  // Above the early returns: hooks cannot run conditionally.
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

  return <ProductForm product={data.product} />
}
