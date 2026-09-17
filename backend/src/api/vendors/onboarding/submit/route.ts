import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { getVendorId } from "../../shared/vendor-scope"
import { onboardingStore } from "../../../../lib/onboarding-store"
import { submitOnboarding } from "../../../../lib/trustclaw"

/**
 * Submits the vendor's completed onboarding application for administrator review.
 * Injects vendor.id from the authenticated session.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const vendorId = await getVendorId(req)

  // 1. Mark as UNDER_REVIEW in local onboarding store
  const updatedRecord = onboardingStore.submit(vendorId)

  // 2. Try submitting to TrustClaw upstream
  try {
    await submitOnboarding(vendorId)
  } catch {
    // Non-blocking if remote is offline
  }

  res.json({
    result: {
      success: true,
      status: updatedRecord.status,
      submittedAt: updatedRecord.submittedAt || new Date().toISOString(),
    },
  })
}
