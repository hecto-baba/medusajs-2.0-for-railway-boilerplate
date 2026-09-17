"use client"

import {
  type VendorOnboardingStepName,
  type VendorQuestionField,
  type VendorQuestionSet,
} from "@lib/data/vendor-client"
import { Button, Heading, Text, toast } from "@medusajs/ui"
import { useVendorOnboardingQuestions } from "../hooks/use-onboarding"
import { DynamicFieldRenderer } from "./dynamic-field-renderer"
import { useState, useMemo } from "react"
import {
  DocumentText,
  MapPin,
  Clock,
  Phone,
  ShieldCheck,
  Photo,
} from "@medusajs/icons"

interface StepQuestionsProps {
  step: VendorOnboardingStepName
  title: string
  description: string
  vendorCategoryId?: string
  segmentId?: string
  vendorTypeId?: string
  answers: Record<string, any>
  onChange: (fieldId: string, value: any) => void
  onNext: () => void
  onBack: () => void
  isSaving: boolean
}

/** Canonical fallback schema if TrustClaw has not defined custom fields */
const DEFAULT_SCHEMAS: Record<string, VendorQuestionField[]> = {
  IDENTITY: [
    {
      id: "business_legal_name",
      name: "business_legal_name",
      label: "Legal Business Name",
      type: "TEXT",
      placeholder: "e.g. Acme Enterprises Pvt Ltd",
      required: true,
    },
    {
      id: "trade_name",
      name: "trade_name",
      label: "Store / Trade Name",
      type: "TEXT",
      placeholder: "e.g. Acme Store",
      required: true,
    },
    {
      id: "business_type",
      name: "business_type",
      label: "Business Entity Type",
      type: "SELECT",
      required: true,
      options: [
        { label: "Private Limited (Pvt Ltd)", value: "PVT_LTD" },
        { label: "Sole Proprietorship", value: "PROPRIETORSHIP" },
        { label: "Partnership / LLP", value: "LLP" },
        { label: "Public Limited", value: "PUBLIC_LTD" },
        { label: "Individual / Freelancer", value: "INDIVIDUAL" },
      ],
    },
    {
      id: "tax_id",
      name: "tax_id",
      label: "Tax ID / GSTIN / VAT Number",
      type: "TEXT",
      placeholder: "e.g. 29AAAAA0000A1Z5",
      required: true,
    },
    {
      id: "registration_number",
      name: "registration_number",
      label: "Company Registration / CIN Number",
      type: "TEXT",
      placeholder: "e.g. U74999KA2020PTC134000",
      required: false,
    },
    {
      id: "year_established",
      name: "year_established",
      label: "Year of Establishment",
      type: "NUMBER",
      placeholder: "2020",
      required: false,
    },
  ],
  LOCATION: [
    {
      id: "registered_address",
      name: "registered_address",
      label: "Registered Business Address",
      type: "LOCATION_GEO",
      required: true,
    },
    {
      id: "warehouse_address",
      name: "warehouse_address",
      label: "Warehouse / Dispatch Center Address",
      type: "LOCATION_GEO",
      required: false,
    },
    {
      id: "service_radius_km",
      name: "service_radius_km",
      label: "Delivery / Service Coverage Radius (km)",
      type: "NUMBER",
      placeholder: "e.g. 50 (leave blank for nationwide)",
      required: false,
    },
  ],
  OPERATIONS: [
    {
      id: "fulfillment_model",
      name: "fulfillment_model",
      label: "Primary Fulfillment Model",
      type: "RADIO",
      required: true,
      options: [
        { label: "Self-Fulfilled (Vendor Ships Direct)", value: "SELF_SHIP" },
        { label: "Platform / Marketplace Logistics", value: "MARKETPLACE_LOGISTICS" },
        { label: "In-Store Pickup / Click & Collect", value: "STORE_PICKUP" },
        { label: "Digital Delivery / E-Ticket", value: "DIGITAL_DELIVERY" },
      ],
    },
    {
      id: "dispatch_sla_hours",
      name: "dispatch_sla_hours",
      label: "Order Handling & Dispatch SLA (Hours)",
      type: "SELECT",
      required: true,
      options: [
        { label: "Same Day Dispatch (< 6 hours)", value: "6" },
        { label: "24 Hours Dispatch (Standard)", value: "24" },
        { label: "48 Hours Dispatch", value: "48" },
        { label: "Made to Order (3-5 business days)", value: "120" },
      ],
    },
    {
      id: "return_window_days",
      name: "return_window_days",
      label: "Standard Customer Return Window (Days)",
      type: "SELECT",
      required: true,
      options: [
        { label: "No Returns (Only Replacements)", value: "0" },
        { label: "7 Days Return Policy", value: "7" },
        { label: "14 Days Return Policy", value: "14" },
        { label: "30 Days Return Policy", value: "30" },
      ],
    },
    {
      id: "operating_hours",
      name: "operating_hours",
      label: "Operating Hours & Customer Service Times",
      type: "TEXT",
      placeholder: "e.g. Mon-Sat: 9:00 AM - 7:00 PM",
      required: false,
    },
  ],
  CONTACT: [
    {
      id: "support_email",
      name: "support_email",
      label: "Customer Support Email",
      type: "TEXT",
      placeholder: "support@yourstore.com",
      required: true,
    },
    {
      id: "support_phone",
      name: "support_phone",
      label: "Support Hotline / WhatsApp Phone",
      type: "TEXT",
      placeholder: "+1 (555) 000-0000",
      required: true,
    },
    {
      id: "escalation_contact_person",
      name: "escalation_contact_person",
      label: "Operations / Escalation Manager Name",
      type: "TEXT",
      placeholder: "e.g. John Doe",
      required: true,
    },
    {
      id: "website_url",
      name: "website_url",
      label: "Existing Website / Portfolio (Optional)",
      type: "TEXT",
      placeholder: "https://yourbrand.com",
      required: false,
    },
  ],
  KYC: [
    {
      id: "tax_certificate_doc",
      name: "tax_certificate_doc",
      label: "Tax ID / GST Registration Certificate",
      type: "FILE_UPLOAD",
      required: true,
      description: "Official government-issued tax certificate",
    },
    {
      id: "business_registration_doc",
      name: "business_registration_doc",
      label: "Certificate of Incorporation / Trade License",
      type: "FILE_UPLOAD",
      required: true,
      description: "Company registration document or license",
    },
    {
      id: "bank_statement_doc",
      name: "bank_statement_doc",
      label: "Cancelled Cheque or Recent Bank Statement",
      type: "FILE_UPLOAD",
      required: true,
      description: "Proof of account details for automated payouts",
    },
    {
      id: "authorized_signatory_id_doc",
      name: "authorized_signatory_id_doc",
      label: "Director / Owner Identity Proof (Passport/National ID)",
      type: "FILE_UPLOAD",
      required: false,
      description: "Government-issued photo identification",
    },
  ],
  SHOWCASE: [
    {
      id: "store_logo",
      name: "store_logo",
      label: "Store Brand Logo (Square 1:1)",
      type: "FILE_UPLOAD",
      required: false,
      description: "High resolution PNG or SVG (500x500px)",
    },
    {
      id: "store_banner",
      name: "store_banner",
      label: "Storefront Banner Image (16:9)",
      type: "FILE_UPLOAD",
      required: false,
      description: "Landscape hero banner (1920x600px)",
    },
    {
      id: "brand_story",
      name: "brand_story",
      label: "Brand Story / About the Store",
      type: "TEXTAREA",
      placeholder: "Tell buyers about your company, craftsmanship, or specialities...",
      required: false,
    },
  ],
}

const STEP_ICONS: Record<string, any> = {
  IDENTITY: DocumentText,
  LOCATION: MapPin,
  OPERATIONS: Clock,
  CONTACT: Phone,
  KYC: ShieldCheck,
  SHOWCASE: Photo,
}

export function OnboardingStepQuestions({
  step,
  title,
  description,
  vendorCategoryId,
  segmentId,
  vendorTypeId,
  answers,
  onChange,
  onNext,
  onBack,
  isSaving,
}: StepQuestionsProps) {
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: questionSets = [] } = useVendorOnboardingQuestions({
    step,
    vendorCategoryId,
    segmentId,
    vendorTypeId,
  })

  const dynamicSet = questionSets.find((qs) => qs.step === step)

  const effectiveTitle = dynamicSet?.title || title
  const effectiveDescription = dynamicSet?.subtitle || dynamicSet?.description || description

  const fields: VendorQuestionField[] = useMemo(() => {
    // 1. If dynamic question set exists from TrustClaw API, extract its exact questions
    if (dynamicSet) {
      if (dynamicSet.fields && dynamicSet.fields.length > 0) {
        return dynamicSet.fields
      }
      if (dynamicSet.questions && dynamicSet.questions.length > 0) {
        return dynamicSet.questions.map((q: any) => {
          const key = q.key || q.id || q.name
          return {
            id: key,
            name: key,
            key: key,
            label: q.label || key,
            description: q.helpText || q.description || null,
            helpText: q.helpText || q.description || null,
            type: (q.type || "text").toLowerCase(),
            placeholder: q.placeholder || null,
            required: Boolean(q.required),
            order: typeof q.order === "number" ? q.order : 0,
            options: q.options,
            minCount: q.minCount,
            maxCount: q.maxCount,
          }
        })
      }
    }
    // 2. Otherwise use the canonical fallback fields
    return DEFAULT_SCHEMAS[step] || []
  }, [dynamicSet, step])

  const StepIcon = STEP_ICONS[step] || DocumentText

  const handleValidateAndNext = () => {
    const newErrors: Record<string, string> = {}

    for (const field of fields) {
      if (field.required) {
        const val = answers[field.id]
        if (
          val === undefined ||
          val === null ||
          val === "" ||
          (Array.isArray(val) && val.length === 0) ||
          (typeof val === "object" && !val.address && (String(field.type).toUpperCase() === "LOCATION_GEO" || String(field.type).toUpperCase() === "ADDRESS"))
        ) {
          newErrors[field.id] = `${field.label} is required.`
        } else if (field.minCount && Array.isArray(val) && val.length < field.minCount) {
          newErrors[field.id] = `${field.label} requires at least ${field.minCount} photos.`
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      toast.error("Please fill in all required fields to continue.")
      return
    }

    setErrors({})
    onNext()
  }

  return (
    <div className="flex flex-col gap-y-6">
      {/* Step Header */}
      <div className="flex flex-col gap-y-1.5 border-b border-ui-border-base pb-4">
        <div className="flex items-center gap-x-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ui-bg-interactive text-ui-fg-on-color shrink-0">
            <StepIcon className="h-4 w-4" />
          </span>
          <Heading level="h2" className="text-lg font-semibold text-ui-fg-base">
            {effectiveTitle}
          </Heading>
        </div>
        {effectiveDescription ? (
          <Text size="small" className="text-ui-fg-subtle text-xs">
            {effectiveDescription}
          </Text>
        ) : null}
      </div>

      {/* Fields List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
        {fields.map((field) => {
          const normType = String(field.type || "").toUpperCase()
          const isWide =
            normType === "TEXTAREA" ||
            normType === "LOCATION_GEO" ||
            normType === "ADDRESS" ||
            normType === "FILE_UPLOAD" ||
            normType === "IMAGE" ||
            normType === "OPERATING_HOURS" ||
            normType === "MULTI_SELECT"

          return (
            <div
              key={field.id}
              className={isWide ? "md:col-span-2" : "col-span-1"}
            >
              <DynamicFieldRenderer
                field={field}
                value={answers[field.id]}
                onChange={(val) => {
                  onChange(field.id, val)
                  if (errors[field.id]) {
                    setErrors((prev) => {
                      const next = { ...prev }
                      delete next[field.id]
                      return next
                    })
                  }
                }}
                error={errors[field.id]}
              />
            </div>
          )
        })}
      </div>

      {/* Navigation Actions */}
      <div className="flex items-center justify-between pt-6 border-t border-ui-border-base mt-2">
        <Button
          variant="secondary"
          onClick={onBack}
          disabled={isSaving}
          type="button"
        >
          ← Back
        </Button>
        <Button
          variant="primary"
          onClick={handleValidateAndNext}
          isLoading={isSaving}
          type="button"
        >
          Continue →
        </Button>
      </div>
    </div>
  )
}
