"use client"

import {
  type VendorOnboardingData,
} from "@lib/data/vendor-client"
import { Badge, Button, Heading, Text } from "@medusajs/ui"
import {
  Clock,
  CheckCircleSolid,
  ShieldCheck,
  BuildingStorefront,
  ArrowPath,
} from "@medusajs/icons"

interface UnderReviewProps {
  onboarding: VendorOnboardingData
  onRefresh: () => void
  isRefreshing?: boolean
}

export function OnboardingUnderReview({
  onboarding,
  onRefresh,
  isRefreshing,
}: UnderReviewProps) {
  const segment = onboarding.segment?.name || "Selected Vertical"
  const vendorType = onboarding.vendorType?.name || "Standard Model"
  const vendorCategory = onboarding.vendorCategory?.name || "Classification"

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 flex flex-col gap-y-8">
      {/* Status Hero Card */}
      <div className="bg-ui-bg-base border border-ui-border-base rounded-xl p-8 shadow-elevation-card-rest flex flex-col items-center text-center gap-y-4">
        <div className="relative flex items-center justify-center h-20 w-20 rounded-full bg-ui-bg-interactive/10 text-ui-fg-interactive">
          <Clock className="h-10 w-10 animate-pulse" />
          <span className="absolute top-1 right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ui-bg-interactive opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-ui-bg-interactive"></span>
          </span>
        </div>

        <div className="flex flex-col gap-y-1.5 max-w-lg">
          <div className="flex items-center justify-center gap-x-2">
            <Heading level="h1" className="text-2xl font-bold text-ui-fg-base">
              Application Under Review
            </Heading>
            <Badge color="blue" size="small">
              Under Review
            </Badge>
          </div>
          <Text size="base" className="text-ui-fg-subtle">
            Thank you for completing your onboarding! Our compliance and operations team
            is currently reviewing your store registration and verification documents.
          </Text>
        </div>

        <div className="flex items-center gap-x-3 pt-2">
          <Button
            variant="secondary"
            size="small"
            onClick={onRefresh}
            isLoading={isRefreshing}
            className="flex items-center gap-x-1.5"
          >
            <ArrowPath className="h-3.5 w-3.5" /> Check Status
          </Button>
        </div>
      </div>

      {/* Progress Timeline */}
      <div className="bg-ui-bg-base border border-ui-border-base rounded-xl p-6 shadow-elevation-card-rest flex flex-col gap-y-6">
        <Heading level="h3" className="text-base font-semibold text-ui-fg-base">
          Verification Milestones
        </Heading>

        <div className="flex flex-col gap-y-6 relative pl-6 border-l-2 border-ui-border-base">
          {/* Step 1 */}
          <div className="relative flex flex-col gap-y-1">
            <span className="absolute -left-[31px] top-0 flex h-6 w-6 items-center justify-center rounded-full bg-ui-bg-interactive text-ui-fg-on-color">
              <CheckCircleSolid className="h-4 w-4" />
            </span>
            <span className="font-semibold text-sm text-ui-fg-base">
              1. Onboarding Submission Received
            </span>
            <Text size="small" className="text-ui-fg-subtle">
              Your business profile, operations details, and KYC credentials were submitted successfully.
            </Text>
          </div>

          {/* Step 2 */}
          <div className="relative flex flex-col gap-y-1">
            <span className="absolute -left-[31px] top-0 flex h-6 w-6 items-center justify-center rounded-full bg-ui-bg-interactive/20 text-ui-fg-interactive ring-4 ring-ui-bg-base">
              <ShieldCheck className="h-4 w-4 animate-bounce" />
            </span>
            <div className="flex items-center gap-x-2">
              <span className="font-semibold text-sm text-ui-fg-interactive">
                2. Compliance & Document Audit
              </span>
              <Badge color="blue" size="xsmall">In Progress</Badge>
            </div>
            <Text size="small" className="text-ui-fg-subtle">
              Reviewing legal business registration, tax certificates, and banking compliance. Expected completion in 24 hours.
            </Text>
          </div>

          {/* Step 3 */}
          <div className="relative flex flex-col gap-y-1">
            <span className="absolute -left-[31px] top-0 flex h-6 w-6 items-center justify-center rounded-full bg-ui-bg-subtle text-ui-fg-muted ring-4 ring-ui-bg-base border border-ui-border-base">
              <BuildingStorefront className="h-3.5 w-3.5" />
            </span>
            <span className="font-semibold text-sm text-ui-fg-muted">
              3. Category Activation & Seller Dashboard Unlock
            </span>
            <Text size="small" className="text-ui-fg-muted">
              Once approved, your role-specific dashboard will unlock with catalog publishing and order processing features.
            </Text>
          </div>
        </div>
      </div>

      {/* Profile Summary Card */}
      <div className="bg-ui-bg-subtle/60 border border-ui-border-base rounded-xl p-5 flex flex-col gap-y-3 text-xs">
        <span className="font-semibold text-ui-fg-base uppercase tracking-wider text-[11px]">
          Registered Store Summary
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <span className="text-ui-fg-muted block">Vertical:</span>
            <span className="font-semibold text-ui-fg-base">{segment}</span>
          </div>
          <div>
            <span className="text-ui-fg-muted block">Operating Model:</span>
            <span className="font-semibold text-ui-fg-base">{vendorType}</span>
          </div>
          <div>
            <span className="text-ui-fg-muted block">Classification:</span>
            <span className="font-semibold text-ui-fg-base">{vendorCategory}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
