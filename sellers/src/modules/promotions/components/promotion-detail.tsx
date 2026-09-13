"use client"

import { getVendorPromotion } from "@lib/data/vendor-client"
import { Button, Heading, StatusBadge, Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"

const PROMOTION_STATUS: Record<string, ["grey" | "orange" | "green", string]> = {
  draft: ["grey", "Draft"],
  active: ["green", "Active"],
  inactive: ["orange", "Inactive"],
}

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-center justify-between py-2">
    <Text size="small" className="text-ui-fg-subtle">
      {label}
    </Text>
    <Text size="small">{value}</Text>
  </div>
)

/**
 * Fetched client-side on purpose, same reasoning as ProductDetail: a foreign
 * or unknown id then renders an error state instead of throwing during a
 * server render, and the request carries the session cookie through the
 * /api/vendors proxy.
 */
export const PromotionDetail = ({ id }: { id: string }) => {
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

  const promotion = data.promotion
  const method = promotion.application_method
  const [color, label] = PROMOTION_STATUS[promotion.status] ?? ["grey", promotion.status]

  const targetProducts =
    method?.target_rules?.find((rule) => rule.attribute === "product")
      ?.values ?? []
  const buyProducts =
    method?.buy_rules?.find((rule) => rule.attribute === "product")?.values ??
    []

  return (
    <div className="flex flex-col gap-6 xl:max-w-2xl">
      <div className="flex items-center justify-between">
        <Heading level="h1">{promotion.code}</Heading>
        <Link href={`/promotions/${promotion.id}/edit`}>
          <Button variant="secondary">Edit</Button>
        </Link>
      </div>

      <div className="bg-ui-bg-base shadow-elevation-card-rest flex flex-col gap-y-1 rounded-lg p-6">
        <Row label="Status" value={<StatusBadge color={color}>{label}</StatusBadge>} />
        <Row
          label="Type"
          value={promotion.type === "buyget" ? "Buy X, get Y" : "Amount off"}
        />
        <Row label="Automatic" value={promotion.is_automatic ? "Yes" : "No"} />
        {method && (
          <Row
            label="Discount"
            value={
              method.type === "percentage"
                ? `${method.value}%`
                : `${method.value} ${method.currency_code?.toUpperCase() ?? ""}`
            }
          />
        )}
        {method?.allocation && (
          <Row
            label="Allocation"
            value={
              method.allocation === "across"
                ? "Across"
                : method.allocation === "once"
                  ? "Once"
                  : "Each"
            }
          />
        )}
        <Row
          label="Usage limit"
          value={promotion.limit ?? "No limit"}
        />
        <Row label="Used" value={promotion.used ?? 0} />
      </div>

      <div className="bg-ui-bg-base shadow-elevation-card-rest flex flex-col gap-y-2 rounded-lg p-6">
        <Heading level="h2">Discounted products</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          {targetProducts.length} product
          {targetProducts.length === 1 ? "" : "s"} selected.
        </Text>
      </div>

      {promotion.type === "buyget" && (
        <div className="bg-ui-bg-base shadow-elevation-card-rest flex flex-col gap-y-2 rounded-lg p-6">
          <Heading level="h2">Products the customer must buy</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            {buyProducts.length} product{buyProducts.length === 1 ? "" : "s"}{" "}
            selected.
          </Text>
        </div>
      )}
    </div>
  )
}
