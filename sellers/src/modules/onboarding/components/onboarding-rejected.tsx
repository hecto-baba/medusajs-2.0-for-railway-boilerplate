"use client"

import {
  type VendorOnboardingData,
} from "@lib/data/vendor-client"
import { Badge, Button, Heading, Text } from "@medusajs/ui"
import { ExclamationCircle, PencilSquare } from "@medusajs/icons"

interface RejectedProps {
  onboarding: VendorOnboardingData
  onEditAndResubmit: () => void
}

export function OnboardingRejected({
  onboarding,
  onEditAndResubmit,
}: RejectedProps) {
  const reason =
    onboarding.rejectionReason ||
    onboarding.feedback ||
    "Some documents or store details did not meet our verification criteria. Please review the requirements and resubmit."

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 flex flex-col gap-y-6">
      <div className="bg-ui-bg-base border border-ui-border-error/40 rounded-xl p-8 shadow-elevation-card-rest flex flex-col items-center text-center gap-y-4">
        <div className="flex items-center justify-center h-16 w-16 rounded-full bg-ui-bg-error/10 text-ui-fg-error">
          <ExclamationCircle className="h-8 w-8" />
        </div>

        <div className="flex flex-col gap-y-1.5">
          <div className="flex items-center justify-center gap-x-2">
            <Heading level="h1" className="text-2xl font-bold text-ui-fg-base">
              Application Changes Requested
            </Heading>
            <Badge color="red" size="small">
              Changes Required
            </Badge>
          </div>
          <Text size="base" className="text-ui-fg-subtle">
            Our compliance team reviewed your application and requested revisions before approval.
          </Text>
        </div>

        {/* Feedback Card */}
        <div className="w-full text-left p-4 rounded-lg bg-ui-bg-subtle border border-ui-border-base flex flex-col gap-y-1.5 mt-2">
          <span className="text-xs font-semibold text-ui-fg-error uppercase tracking-wider">
            Reviewer Feedback & Instructions:
          </span>
          <Text size="small" className="text-ui-fg-base whitespace-pre-wrap">
            {reason}
          </Text>
        </div>

        <div className="flex items-center gap-x-3 pt-4">
          <Button
            variant="primary"
            onClick={onEditAndResubmit}
            className="flex items-center gap-x-1.5"
          >
            <PencilSquare className="h-4 w-4" /> Edit & Resubmit Application
          </Button>
        </div>
      </div>
    </div>
  )
}
