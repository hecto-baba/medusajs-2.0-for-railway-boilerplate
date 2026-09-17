"use client"

import {
  type VendorOnboardingData,
  type VendorOnboardingStepName,
} from "@lib/data/vendor-client"
import { Badge, Button, Heading, Text, toast } from "@medusajs/ui"
import { useState, useEffect } from "react"
import {
  useVendorOnboardingAnswers,
  useSaveVendorOnboardingStep,
  useSubmitVendorOnboarding,
  useTaxonomySegments,
  useTaxonomyVendorTypes,
  useTaxonomyVendorCategories,
} from "../hooks/use-onboarding"
import { OnboardingStepVertical } from "./onboarding-step-vertical"
import { OnboardingStepQuestions } from "./onboarding-step-questions"
import { OnboardingStepReview } from "./onboarding-step-review"
import { OnboardingUnderReview } from "./onboarding-under-review"
import { OnboardingRejected } from "./onboarding-rejected"
import {
  BuildingStorefront,
  DocumentText,
  MapPin,
  Clock,
  Phone,
  ShieldCheck,
  Photo,
  CheckCircleSolid,
} from "@medusajs/icons"

const WIZARD_STEPS = [
  {
    id: "VERTICAL",
    stepName: "SEGMENT_SELECTION" as VendorOnboardingStepName,
    title: "Vertical & Model",
    shortTitle: "Classification",
    description: "Industry vertical, operating model, and store category.",
    icon: BuildingStorefront,
  },
  {
    id: "IDENTITY",
    stepName: "IDENTITY" as VendorOnboardingStepName,
    title: "Business Identity",
    shortTitle: "Identity",
    description: "Legal entity details, registration numbers, and tax ID.",
    icon: DocumentText,
  },
  {
    id: "LOCATION",
    stepName: "LOCATION" as VendorOnboardingStepName,
    title: "Location & Coverage",
    shortTitle: "Location",
    description: "Store address, dispatch center, and service radius.",
    icon: MapPin,
  },
  {
    id: "OPERATIONS",
    stepName: "OPERATIONS" as VendorOnboardingStepName,
    title: "Fulfillment & SLAs",
    shortTitle: "Operations",
    description: "Shipping methods, dispatch SLAs, and return policies.",
    icon: Clock,
  },
  {
    id: "CONTACT",
    stepName: "CONTACT" as VendorOnboardingStepName,
    title: "Support & Contact",
    shortTitle: "Contact",
    description: "Customer service hotlines and escalation contacts.",
    icon: Phone,
  },
  {
    id: "KYC",
    stepName: "KYC" as VendorOnboardingStepName,
    title: "KYC & Verification",
    shortTitle: "KYC",
    description: "Official registration licenses and payout bank proof.",
    icon: ShieldCheck,
  },
  {
    id: "SHOWCASE",
    stepName: "SHOWCASE" as VendorOnboardingStepName,
    title: "Branding & Showcase",
    shortTitle: "Showcase",
    description: "Store logo, banner visuals, and brand story.",
    icon: Photo,
  },
  {
    id: "REVIEW",
    stepName: "REVIEW" as VendorOnboardingStepName,
    title: "Review & Submit",
    shortTitle: "Submit",
    description: "Verify all entered details and submit for approval.",
    icon: CheckCircleSolid,
  },
]

interface OnboardingWizardProps {
  onboarding: VendorOnboardingData
  onStatusRefresh: () => void
}

export function OnboardingWizard({
  onboarding,
  onStatusRefresh,
}: OnboardingWizardProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [segmentId, setSegmentId] = useState<string | undefined>(
    onboarding.segment?.id
  )
  const [vendorTypeId, setVendorTypeId] = useState<string | undefined>(
    onboarding.vendorType?.id
  )
  const [vendorCategoryId, setVendorCategoryId] = useState<string | undefined>(
    onboarding.vendorCategory?.id
  )

  // Step-wise answers dictionary: stepId -> { fieldId: value }
  const [answers, setAnswers] = useState<Record<string, Record<string, any>>>({})
  const [isResubmitting, setIsResubmitting] = useState(false)

  const { data: savedAnswersData } = useVendorOnboardingAnswers()
  const saveStepMutation = useSaveVendorOnboardingStep()
  const submitMutation = useSubmitVendorOnboarding()

  const { data: segments = [] } = useTaxonomySegments()
  const { data: vendorTypes = [] } = useTaxonomyVendorTypes({ segmentId })
  const { data: vendorCategories = [] } = useTaxonomyVendorCategories({
    segmentId,
    vendorTypeId,
  })

  // Prepopulate saved answers when loaded
  useEffect(() => {
    if (savedAnswersData) {
      if (savedAnswersData.segmentId && !segmentId) {
        setSegmentId(savedAnswersData.segmentId)
      }
      if (savedAnswersData.vendorTypeId && !vendorTypeId) {
        setVendorTypeId(savedAnswersData.vendorTypeId)
      }
      if (savedAnswersData.vendorCategoryId && !vendorCategoryId) {
        setVendorCategoryId(savedAnswersData.vendorCategoryId)
      }
      if (savedAnswersData.answers && Object.keys(savedAnswersData.answers).length > 0) {
        setAnswers((prev) => {
          const merged: Record<string, Record<string, any>> = {}
          for (const [stepKey, stepVal] of Object.entries(savedAnswersData.answers || {})) {
            merged[stepKey] = { ...(stepVal || {}) }
          }
          for (const [stepKey, stepVal] of Object.entries(prev || {})) {
            merged[stepKey] = { ...(merged[stepKey] || {}), ...(stepVal || {}) }
          }
          return merged
        })
      }
    }
  }, [savedAnswersData])

  // Handle Under Review state
  if (
    (onboarding.status === "SUBMITTED" || onboarding.status === "UNDER_REVIEW") &&
    !isResubmitting
  ) {
    return (
      <OnboardingUnderReview
        onboarding={onboarding}
        onRefresh={onStatusRefresh}
      />
    )
  }

  // Handle Rejected state
  if (onboarding.status === "REJECTED" && !isResubmitting) {
    return (
      <OnboardingRejected
        onboarding={onboarding}
        onEditAndResubmit={() => setIsResubmitting(true)}
      />
    )
  }

  const currentStep = WIZARD_STEPS[currentStepIndex]
  const progressPercent = Math.round(
    ((currentStepIndex + 1) / WIZARD_STEPS.length) * 100
  )

  const handleFieldChange = (stepKey: string, fieldId: string, val: any) => {
    setAnswers((prev) => ({
      ...prev,
      [stepKey]: {
        ...(prev[stepKey] || {}),
        [fieldId]: val,
      },
    }))
  }

  const handleNextStep = async () => {
    // Save draft for current step
    try {
      const selectedSeg = segments.find((s) => s.id === segmentId)
      const selectedVT = vendorTypes.find((vt) => vt.id === vendorTypeId)
      const selectedVC = vendorCategories.find((vc) => vc.id === vendorCategoryId)

      const taxonomyPayload = {
        segmentId,
        vendorTypeId,
        vendorCategoryId,
        segment: selectedSeg ? { id: selectedSeg.id, name: selectedSeg.name, code: selectedSeg.code } : undefined,
        vendorType: selectedVT ? { id: selectedVT.id, name: selectedVT.name, code: selectedVT.code } : undefined,
        vendorCategory: selectedVC ? { id: selectedVC.id, name: selectedVC.name, code: selectedVC.code } : undefined,
      }

      if (currentStep.id === "VERTICAL") {
        await saveStepMutation.mutateAsync({
          step: "SEGMENT_SELECTION",
          ...taxonomyPayload,
          answers: {},
        })
      } else if (currentStep.id !== "REVIEW") {
        await saveStepMutation.mutateAsync({
          step: currentStep.stepName,
          ...taxonomyPayload,
          answers: answers[currentStep.id] || {},
        })
      }

      if (currentStepIndex < WIZARD_STEPS.length - 1) {
        setCurrentStepIndex((prev) => prev + 1)
        window.scrollTo({ top: 0, behavior: "smooth" })
      }
    } catch {
      toast.error("Failed to save progress. Please try again.")
    }
  }

  const handleFinalSubmit = async () => {
    try {
      await submitMutation.mutateAsync()
      toast.success("Application submitted successfully!")
      setIsResubmitting(false)
      onStatusRefresh()
    } catch {
      toast.error("Submission failed. Please try again.")
    }
  }

  const selectedSegmentName = segments.find((s) => s.id === segmentId)?.name
  const selectedVendorTypeName = vendorTypes.find((vt) => vt.id === vendorTypeId)?.name
  const selectedCategoryName = vendorCategories.find((vc) => vc.id === vendorCategoryId)?.name

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 flex flex-col gap-y-6">
      {/* Top Header Card */}
      <div className="bg-ui-bg-base border border-ui-border-base rounded-xl p-6 shadow-elevation-card-rest flex flex-col gap-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-col">
            <div className="flex items-center gap-x-2">
              <Heading level="h1" className="text-xl font-bold text-ui-fg-base">
                Merchant Onboarding Wizard
              </Heading>
              <Badge color="blue" size="xsmall">
                Step {currentStepIndex + 1} of {WIZARD_STEPS.length}
              </Badge>
            </div>
            <Text size="small" className="text-ui-fg-subtle">
              Complete the verification steps below to unlock your marketplace seller account.
            </Text>
          </div>
          <div className="flex items-center gap-x-2">
            <span className="text-xs font-semibold text-ui-fg-interactive">
              {progressPercent}% Completed
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-ui-bg-subtle rounded-full h-2 overflow-hidden border border-ui-border-base">
          <div
            className="bg-ui-bg-interactive h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Horizontal Steps Navigation Pills */}
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 pt-1">
          {WIZARD_STEPS.map((step, idx) => {
            const isCurrent = idx === currentStepIndex
            const isCompleted = idx < currentStepIndex
            const StepIcon = step.icon

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => {
                  // Allow clicking previously completed steps
                  if (idx <= currentStepIndex) {
                    setCurrentStepIndex(idx)
                  }
                }}
                disabled={idx > currentStepIndex}
                className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all ${
                  isCurrent
                    ? "border-ui-border-interactive bg-ui-bg-interactive/10 text-ui-fg-interactive"
                    : isCompleted
                    ? "border-ui-border-base bg-ui-bg-subtle text-ui-fg-base hover:border-ui-border-strong cursor-pointer"
                    : "border-transparent bg-transparent text-ui-fg-muted cursor-not-allowed opacity-50"
                }`}
              >
                <StepIcon className="h-4 w-4 mb-1" />
                <span className="text-[10px] font-medium truncate w-full">
                  {step.shortTitle}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Step Content Card */}
      <div className="bg-ui-bg-base border border-ui-border-base rounded-xl p-6 sm:p-8 shadow-elevation-card-rest">
        {currentStep.id === "VERTICAL" && (
          <OnboardingStepVertical
            segmentId={segmentId}
            vendorTypeId={vendorTypeId}
            vendorCategoryId={vendorCategoryId}
            onChange={(updates) => {
              if (updates.segmentId !== undefined) setSegmentId(updates.segmentId)
              if (updates.vendorTypeId !== undefined) setVendorTypeId(updates.vendorTypeId)
              if (updates.vendorCategoryId !== undefined) setVendorCategoryId(updates.vendorCategoryId)
            }}
            onNext={handleNextStep}
            isSaving={saveStepMutation.isPending}
          />
        )}

        {currentStep.id !== "VERTICAL" && currentStep.id !== "REVIEW" && (
          <OnboardingStepQuestions
            step={currentStep.stepName}
            title={currentStep.title}
            description={currentStep.description}
            vendorCategoryId={vendorCategoryId}
            segmentId={segmentId}
            vendorTypeId={vendorTypeId}
            answers={answers[currentStep.id] || {}}
            onChange={(fieldId, val) =>
              handleFieldChange(currentStep.id, fieldId, val)
            }
            onNext={handleNextStep}
            onBack={() => setCurrentStepIndex((prev) => Math.max(0, prev - 1))}
            isSaving={saveStepMutation.isPending}
          />
        )}

        {currentStep.id === "REVIEW" && (
          <OnboardingStepReview
            segmentName={selectedSegmentName}
            vendorTypeName={selectedVendorTypeName}
            vendorCategoryName={selectedCategoryName}
            allAnswers={answers}
            onGoToStep={(stepIdx) => setCurrentStepIndex(stepIdx)}
            onSubmit={handleFinalSubmit}
            onBack={() => setCurrentStepIndex((prev) => Math.max(0, prev - 1))}
            isSubmitting={submitMutation.isPending}
          />
        )}
      </div>
    </div>
  )
}
