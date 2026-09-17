"use client"

import {
  Badge,
  Button,
  Heading,
  Switch,
  Text,
} from "@medusajs/ui"
import { CheckCircleSolid, PencilSquare, DocumentText } from "@medusajs/icons"
import { useState } from "react"

interface StepReviewProps {
  segmentName?: string
  vendorTypeName?: string
  vendorCategoryName?: string
  allAnswers: Record<string, Record<string, any>>
  onGoToStep: (stepIndex: number) => void
  onSubmit: () => void
  onBack: () => void
  isSubmitting: boolean
}

export function OnboardingStepReview({
  segmentName,
  vendorTypeName,
  vendorCategoryName,
  allAnswers,
  onGoToStep,
  onSubmit,
  onBack,
  isSubmitting,
}: StepReviewProps) {
  const [agreed, setAgreed] = useState(false)

  const identity = allAnswers.IDENTITY || {}
  const location = allAnswers.LOCATION || {}
  const operations = allAnswers.OPERATIONS || {}
  const contact = allAnswers.CONTACT || {}
  const kyc = allAnswers.KYC || {}
  const showcase = allAnswers.SHOWCASE || {}

  return (
    <div className="flex flex-col gap-y-6">
      {/* Header */}
      <div className="flex flex-col gap-y-2 border-b border-ui-border-base pb-5">
        <div className="flex items-center gap-x-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ui-bg-interactive text-ui-fg-on-color">
            <CheckCircleSolid className="h-4 w-4" />
          </span>
          <Heading level="h2" className="text-xl font-semibold text-ui-fg-base">
            Review Application & Final Submit
          </Heading>
        </div>
        <Text size="small" className="text-ui-fg-subtle">
          Please review your business details carefully before submitting for platform verification.
          Once submitted, our compliance team will review your application within 24-48 hours.
        </Text>
      </div>

      {/* Review Sections */}
      <div className="flex flex-col gap-y-4">
        {/* Section 0: Vertical & Model */}
        <div className="p-4 rounded-lg border border-ui-border-base bg-ui-bg-subtle/50 flex flex-col gap-y-3">
          <div className="flex items-center justify-between border-b border-ui-border-base pb-2">
            <span className="text-xs font-semibold text-ui-fg-base uppercase tracking-wider">
              1. Vertical & Classification
            </span>
            <Button
              variant="transparent"
              size="small"
              onClick={() => onGoToStep(0)}
              className="text-xs text-ui-fg-interactive flex items-center gap-x-1"
            >
              <PencilSquare className="h-3.5 w-3.5" /> Edit
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-ui-fg-muted block">Vertical:</span>
              <span className="font-semibold text-ui-fg-base">{segmentName || "Selected"}</span>
            </div>
            <div>
              <span className="text-ui-fg-muted block">Operating Model:</span>
              <span className="font-semibold text-ui-fg-base">{vendorTypeName || "Selected"}</span>
            </div>
            <div>
              <span className="text-ui-fg-muted block">Classification:</span>
              <span className="font-semibold text-ui-fg-base">{vendorCategoryName || "Selected"}</span>
            </div>
          </div>
        </div>

        {/* Section 1: Identity */}
        <div className="p-4 rounded-lg border border-ui-border-base bg-ui-bg-subtle/50 flex flex-col gap-y-3">
          <div className="flex items-center justify-between border-b border-ui-border-base pb-2">
            <span className="text-xs font-semibold text-ui-fg-base uppercase tracking-wider">
              2. Business Identity
            </span>
            <Button
              variant="transparent"
              size="small"
              onClick={() => onGoToStep(1)}
              className="text-xs text-ui-fg-interactive flex items-center gap-x-1"
            >
              <PencilSquare className="h-3.5 w-3.5" /> Edit
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-ui-fg-muted block">Legal Name:</span>
              <span className="font-semibold text-ui-fg-base">{identity.business_legal_name || "—"}</span>
            </div>
            <div>
              <span className="text-ui-fg-muted block">Trade / Store Name:</span>
              <span className="font-semibold text-ui-fg-base">{identity.trade_name || "—"}</span>
            </div>
            <div>
              <span className="text-ui-fg-muted block">Entity Type:</span>
              <span className="font-semibold text-ui-fg-base">{identity.business_type || "—"}</span>
            </div>
            <div>
              <span className="text-ui-fg-muted block">Tax / GST ID:</span>
              <span className="font-semibold text-ui-fg-base">{identity.tax_id || "—"}</span>
            </div>
            <div>
              <span className="text-ui-fg-muted block">Registration Number:</span>
              <span className="font-semibold text-ui-fg-base">{identity.registration_number || "—"}</span>
            </div>
          </div>
        </div>

        {/* Section 2: Location */}
        <div className="p-4 rounded-lg border border-ui-border-base bg-ui-bg-subtle/50 flex flex-col gap-y-3">
          <div className="flex items-center justify-between border-b border-ui-border-base pb-2">
            <span className="text-xs font-semibold text-ui-fg-base uppercase tracking-wider">
              3. Location & Service Area
            </span>
            <Button
              variant="transparent"
              size="small"
              onClick={() => onGoToStep(2)}
              className="text-xs text-ui-fg-interactive flex items-center gap-x-1"
            >
              <PencilSquare className="h-3.5 w-3.5" /> Edit
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-ui-fg-muted block">Registered Address:</span>
              <span className="font-semibold text-ui-fg-base">
                {typeof location.registered_address === "object"
                  ? `${location.registered_address?.address || ""}, ${location.registered_address?.city || ""}`
                  : location.registered_address || "—"}
              </span>
            </div>
            <div>
              <span className="text-ui-fg-muted block">Coverage Radius:</span>
              <span className="font-semibold text-ui-fg-base">
                {location.service_radius_km ? `${location.service_radius_km} km` : "Nationwide"}
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: Operations & Contact */}
        <div className="p-4 rounded-lg border border-ui-border-base bg-ui-bg-subtle/50 flex flex-col gap-y-3">
          <div className="flex items-center justify-between border-b border-ui-border-base pb-2">
            <span className="text-xs font-semibold text-ui-fg-base uppercase tracking-wider">
              4. Operations & Contact
            </span>
            <Button
              variant="transparent"
              size="small"
              onClick={() => onGoToStep(3)}
              className="text-xs text-ui-fg-interactive flex items-center gap-x-1"
            >
              <PencilSquare className="h-3.5 w-3.5" /> Edit
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-ui-fg-muted block">Fulfillment Model:</span>
              <span className="font-semibold text-ui-fg-base">{operations.fulfillment_model || "—"}</span>
            </div>
            <div>
              <span className="text-ui-fg-muted block">Dispatch SLA:</span>
              <span className="font-semibold text-ui-fg-base">
                {operations.dispatch_sla_hours ? `${operations.dispatch_sla_hours} hrs` : "—"}
              </span>
            </div>
            <div>
              <span className="text-ui-fg-muted block">Support Email:</span>
              <span className="font-semibold text-ui-fg-base">{contact.support_email || "—"}</span>
            </div>
            <div>
              <span className="text-ui-fg-muted block">Support Phone:</span>
              <span className="font-semibold text-ui-fg-base">{contact.support_phone || "—"}</span>
            </div>
          </div>
        </div>

        {/* Section 4: KYC Documents */}
        <div className="p-4 rounded-lg border border-ui-border-base bg-ui-bg-subtle/50 flex flex-col gap-y-3">
          <div className="flex items-center justify-between border-b border-ui-border-base pb-2">
            <span className="text-xs font-semibold text-ui-fg-base uppercase tracking-wider">
              5. KYC Verification Documents
            </span>
            <Button
              variant="transparent"
              size="small"
              onClick={() => onGoToStep(5)}
              className="text-xs text-ui-fg-interactive flex items-center gap-x-1"
            >
              <PencilSquare className="h-3.5 w-3.5" /> Edit
            </Button>
          </div>
          <div className="flex flex-wrap gap-3">
            {Object.entries(kyc).map(([key, fileVal]) => {
              if (!fileVal) return null
              return (
                <div
                  key={key}
                  className="flex items-center gap-x-2 px-3 py-1.5 rounded-md border border-ui-border-base bg-ui-bg-base text-xs"
                >
                  <DocumentText className="text-ui-fg-interactive h-3.5 w-3.5" />
                  <span className="font-medium text-ui-fg-base">{key.replace(/_/g, " ")}:</span>
                  <Badge color="green" size="xsmall">Attached</Badge>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Compliance & Declaration */}
      <div className="p-4 rounded-lg border border-ui-border-interactive/30 bg-ui-bg-interactive/5 flex items-start gap-x-3">
        <Switch
          id="terms-agree"
          checked={agreed}
          onCheckedChange={setAgreed}
          className="mt-0.5"
        />
        <label htmlFor="terms-agree" className="text-xs text-ui-fg-base cursor-pointer">
          <span className="font-semibold block">Merchant Terms & Compliance Agreement</span>
          I hereby declare that all information, certificates, and tax documents provided above are genuine
          and accurate. I agree to abide by the marketplace merchant code of conduct, fulfillment SLAs, and payout policies.
        </label>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-6 border-t border-ui-border-base">
        <Button variant="secondary" onClick={onBack} disabled={isSubmitting}>
          ← Back
        </Button>
        <Button
          variant="primary"
          disabled={!agreed || isSubmitting}
          isLoading={isSubmitting}
          onClick={onSubmit}
        >
          Submit Onboarding Application
        </Button>
      </div>
    </div>
  )
}
