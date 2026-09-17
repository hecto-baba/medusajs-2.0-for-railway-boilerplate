"use client"

import {
  Badge,
  Button,
  Heading,
  Switch,
  Text,
} from "@medusajs/ui"
import { CheckCircleSolid, PencilSquare, DocumentText, Photo } from "@medusajs/icons"
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

const STEP_ORDER: { step: string; stepIndex: number; title: string }[] = [
  { step: "IDENTITY", stepIndex: 1, title: "2. Business Identity" },
  { step: "LOCATION", stepIndex: 2, title: "3. Location & Service Coverage" },
  { step: "OPERATIONS", stepIndex: 3, title: "4. Fulfillment & Operating Hours" },
  { step: "CONTACT", stepIndex: 4, title: "5. Support & Contact" },
  { step: "KYC", stepIndex: 5, title: "6. KYC & Compliance Verification" },
  { step: "SHOWCASE", stepIndex: 6, title: "7. Store Photos & Showcase" },
]

function formatKeyLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase())
    .replace(/Km\b/, "(km)")
    .replace(/Gst\b/, "GST")
    .replace(/Pan\b/, "PAN")
    .replace(/Kyc\b/, "KYC")
    .replace(/Sla\b/, "SLA")
}

function renderFormattedValue(value: any) {
  if (value === undefined || value === null || value === "") {
    return <span className="text-ui-fg-muted">—</span>
  }

  if (typeof value === "boolean") {
    return (
      <Badge color={value ? "green" : "grey"} size="2xsmall">
        {value ? "Yes / Available" : "No"}
      </Badge>
    )
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-ui-fg-muted">—</span>
    // Check if it's an image list
    const isImages = value.some((v) => typeof v === "string" && (v.includes("/") || v.includes(".")))
    if (isImages) {
      return (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {value.map((url, i) => (
            <Badge key={i} color="blue" size="2xsmall" className="inline-flex items-center gap-1">
              <Photo className="h-3 w-3" /> Photo {i + 1}
            </Badge>
          ))}
        </div>
      )
    }
    return (
      <div className="flex flex-wrap gap-1 pt-0.5">
        {value.map((item, i) => (
          <Badge key={i} color="grey" size="2xsmall">
            {String(item).replace(/_/g, " ")}
          </Badge>
        ))}
      </div>
    )
  }

  if (typeof value === "object") {
    if (value.address) {
      return (
        <span className="font-semibold text-ui-fg-base">
          {[value.address, value.city, value.postalCode, value.country].filter(Boolean).join(", ")}
        </span>
      )
    }
    return <span className="font-semibold text-ui-fg-base">{JSON.stringify(value)}</span>
  }

  if (typeof value === "string" && (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("blob:"))) {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs text-ui-fg-interactive font-medium">
        <DocumentText className="h-3.5 w-3.5" />
        <span className="truncate max-w-[200px]">{value.split("/").pop()}</span>
      </div>
    )
  }

  return <span className="font-semibold text-ui-fg-base">{String(value)}</span>
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

        {/* Dynamic Questionnaire Sections */}
        {STEP_ORDER.map(({ step, stepIndex, title }) => {
          const stepAnswers = allAnswers[step] || {}
          const entries = Object.entries(stepAnswers)

          if (entries.length === 0) return null

          return (
            <div key={step} className="p-4 rounded-lg border border-ui-border-base bg-ui-bg-subtle/50 flex flex-col gap-y-3">
              <div className="flex items-center justify-between border-b border-ui-border-base pb-2">
                <span className="text-xs font-semibold text-ui-fg-base uppercase tracking-wider">
                  {title}
                </span>
                <Button
                  variant="transparent"
                  size="small"
                  onClick={() => onGoToStep(stepIndex)}
                  className="text-xs text-ui-fg-interactive flex items-center gap-x-1"
                >
                  <PencilSquare className="h-3.5 w-3.5" /> Edit
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                {entries.map(([k, v]) => (
                  <div key={k} className="flex flex-col gap-y-0.5">
                    <span className="text-ui-fg-muted text-[11px] block">{formatKeyLabel(k)}:</span>
                    <div className="text-xs">{renderFormattedValue(v)}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
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

