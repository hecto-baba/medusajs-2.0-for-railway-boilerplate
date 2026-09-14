"use client"

import { getVendorPromotion } from "@lib/data/vendor-client"
import { Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { PromotionForm } from "./promotion-form"

/** Fetches the promotion client-side, then hands it to the shared form. */
export const PromotionEditor = ({ id }: { id: string }) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["vendor-promotion", id],
    queryFn: () => getVendorPromotion(id),
    retry: false,
  })

  if (isLoading) {
    return <Text className="text-ui-fg-subtle">Loading…</Text>
  }

  if (error || !data?.promotion) {
    return (
      <Text className="text-ui-fg-error">
        {error instanceof Error ? error.message : "Promotion not found."}
      </Text>
    )
  }

  return <PromotionForm promotion={data.promotion} />
}
