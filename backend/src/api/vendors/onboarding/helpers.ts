import { MedusaError } from "@medusajs/framework/utils"
import { onboardingStore } from "../../../lib/onboarding-store"

/**
 * An application can be edited or submitted only while it is a draft (or after a
 * rejection). Once it is under review or approved, saving answers or submitting
 * again would let an approved seller rewrite what was reviewed, or reset
 * themselves to "under review" (locking their own panel until an admin acts).
 */
export const assertOnboardingEditable = (vendorId: string): void => {
  const { status } = onboardingStore.get(vendorId)

  if (status === "APPROVED") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Your application has been approved and can no longer be changed here."
    )
  }

  if (status === "UNDER_REVIEW") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Your application is under review and cannot be changed until the review is finished."
    )
  }
}
