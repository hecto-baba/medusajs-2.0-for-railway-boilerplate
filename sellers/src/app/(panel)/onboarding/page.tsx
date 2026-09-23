"use client"

import {
  OnboardingWizard,
  useVendorOnboardingStatus,
} from "@modules/onboarding"
import { Button, Heading, Text } from "@medusajs/ui"
import { CheckCircleSolid, ArrowRight } from "@medusajs/icons"
import Link from "next/link"

export default function OnboardingPage() {
  const { data: onboarding, isLoading, refetch } = useVendorOnboardingStatus()

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-y-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-ui-border-interactive border-t-transparent" />
        <Text size="small" className="text-ui-fg-subtle">
          Loading onboarding application...
        </Text>
      </div>
    )
  }

  // If already approved, show success and direct link to dashboard
  if (onboarding?.status === "APPROVED") {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center flex flex-col items-center gap-y-4">
        <div className="h-16 w-16 rounded-full bg-ui-bg-interactive/10 text-ui-fg-interactive flex items-center justify-center">
          <CheckCircleSolid className="h-8 w-8" />
        </div>
        <Heading level="h1" className="text-2xl font-bold text-ui-fg-base">
          Account Verified & Active!
        </Heading>
        <Text size="base" className="text-ui-fg-subtle">
          Your merchant onboarding has been approved. You have full access to your personalized seller dashboard and business tools.
        </Text>
        <Link href="/dashboard" className="pt-4">
          <Button variant="primary" className="flex items-center gap-x-1.5">
            Go to Dashboard <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <OnboardingWizard
      onboarding={
        onboarding || {
          status: "DRAFT",
          currentStep: "SEGMENT_SELECTION",
          completedSteps: [],
          canEdit: true,
        }
      }
      onStatusRefresh={() => refetch()}
    />
  )
}
