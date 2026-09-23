import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { onboardingStore } from "../../../../../../lib/onboarding-store"
import { adminRejectApplication } from "../../../../../../lib/trustclaw"

/**
 * POST /admin/vendors/applications/:id/reject
 *
 * Rejects or requests revisions on a vendor application with reviewer feedback.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id: vendorId } = req.params
  const body = (req.validatedBody ?? req.body) as { reason?: string }
  const reason = body?.reason || "Application requirements not met. Please update the requested fields."

  // 1. Mark as REJECTED in local onboarding store
  const record = onboardingStore.reject(vendorId, reason)

  // 2. Try rejecting upstream in TrustClaw
  try {
    await adminRejectApplication(vendorId, reason)
  } catch {
    // Non-blocking if remote is offline
  }

  res.json({
    result: {
      success: true,
      status: record.status,
      rejectedAt: record.rejectedAt || new Date().toISOString(),
    },
  })
}
