"use client"

import { useState } from "react"
import { Button, Heading, Text, Badge } from "@medusajs/ui"
import { Sparkles, ArrowRight } from "@medusajs/icons"
import { ProductForm } from "./product-form"
import { AddProductModal } from "./add-product-modal"
import { useQuery } from "@tanstack/react-query"
import { useVendorOnboardingStatus } from "@modules/onboarding"
import { getTrustClawSegments } from "@lib/data/vendor-client"

export function NewProductView() {
  const [isCatalogOpen, setIsCatalogOpen] = useState(false)
  const { data: onboarding } = useVendorOnboardingStatus()
  const { data: segments = [] } = useQuery({
    queryKey: ["tc-segments"],
    queryFn: getTrustClawSegments,
    staleTime: 10 * 60 * 1000,
  })

  const matchedSegment = segments.find(
    (s) =>
      (onboarding?.segment?.code && s.code === onboarding.segment.code) ||
      (onboarding?.segmentId && s.id === onboarding.segmentId) ||
      (onboarding?.segmentId && s.code === onboarding.segmentId) ||
      (onboarding?.segment?.name &&
        s.name?.toLowerCase() === onboarding.segment.name.toLowerCase())
  )

  const segmentName =
    matchedSegment?.name ||
    onboarding?.segment?.name ||
    "your vertical"

  return (
    <div className="space-y-6">
      {/* Quick Access to Master Catalog */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50/80 to-indigo-50/50 dark:border-blue-900/50 dark:from-blue-950/20 dark:to-indigo-950/10 p-5 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
            <Sparkles className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Heading level="h3" className="text-base font-semibold text-blue-950 dark:text-blue-100">
                TrustClaw Master Catalog Available
              </Heading>
              <Badge color="blue" size="2xsmall" className="uppercase font-bold">
                Recommended
              </Badge>
            </div>
            <Text size="small" className="text-blue-700/90 dark:text-blue-300/80 mt-0.5 max-w-xl">
              Save time! Browse verified, standardized {segmentName} products with complete descriptions, photos, and categories ready to list on your store.
            </Text>
          </div>
        </div>

        <Button
          variant="primary"
          onClick={() => setIsCatalogOpen(true)}
          className="gap-2 shrink-0 bg-blue-600 hover:bg-blue-700 text-white"
        >
          <span>Browse Master Catalog</span>
          <ArrowRight className="size-4" />
        </Button>
      </div>

      {/* Manual Custom Product Creation Form */}
      <ProductForm />

      {/* Master Catalog Modal */}
      <AddProductModal
        open={isCatalogOpen}
        onOpenChange={setIsCatalogOpen}
      />
    </div>
  )
}
