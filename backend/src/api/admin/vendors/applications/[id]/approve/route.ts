import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { onboardingStore } from "../../../../../../lib/onboarding-store"
import { adminApproveApplication } from "../../../../../../lib/trustclaw"

/**
 * POST /admin/vendors/applications/:id/approve
 *
 * Approves the vendor's onboarding application in Medusa & TrustClaw.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id: vendorId } = req.params

  // 1. Mark as APPROVED in local onboarding store
  const record = onboardingStore.approve(vendorId)

  // 2. Try approving upstream in TrustClaw
  try {
    await adminApproveApplication(vendorId)
  } catch {
    // Non-blocking if remote is offline
  }

  res.json({
    result: {
      success: true,
      status: record.status,
      approvedAt: record.approvedAt || new Date().toISOString(),
    },
  })
}
