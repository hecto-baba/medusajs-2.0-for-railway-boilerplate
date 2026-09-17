import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { getVendorId } from "../../shared/vendor-scope"
import { onboardingStore } from "../../../../lib/onboarding-store"
import {
  fetchOnboardingAnswers,
  type TrustClawAnswersResponse,
} from "../../../../lib/trustclaw"

/**
 * Fetches all saved onboarding answers and submission details for the calling vendor.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const vendorId = await getVendorId(req)
  const localRecord = onboardingStore.get(vendorId)

  try {
    const remote = await fetchOnboardingAnswers(vendorId).catch(() => null)

    const effectiveStatus = (localRecord.status && localRecord.status !== "DRAFT")
      ? localRecord.status
      : (remote?.status || localRecord.status || "DRAFT")

    const response: TrustClawAnswersResponse = {
      vendorId,
      status: effectiveStatus as any,
      segmentId: localRecord.segmentId || remote?.segmentId || null,
      vendorTypeId: localRecord.vendorTypeId || remote?.vendorTypeId || null,
      vendorCategoryId: localRecord.vendorCategoryId || remote?.vendorCategoryId || null,
      answers: {
        ...(remote?.answers || {}),
        ...(localRecord.answers || {}),
      },
      completedSteps:
        localRecord.completedSteps?.length
          ? localRecord.completedSteps
          : remote?.completedSteps || [],
      rejectionReason: localRecord.rejectionReason || remote?.rejectionReason || null,
      feedback: localRecord.feedback || remote?.feedback || null,
    }

    res.json({ answers: response })
  } catch {
    const localResponse: TrustClawAnswersResponse = {
      vendorId,
      status: localRecord.status || "DRAFT",
      segmentId: localRecord.segmentId || null,
      vendorTypeId: localRecord.vendorTypeId || null,
      vendorCategoryId: localRecord.vendorCategoryId || null,
      answers: localRecord.answers || {},
      completedSteps: localRecord.completedSteps || [],
      rejectionReason: localRecord.rejectionReason || null,
      feedback: localRecord.feedback || null,
    }
    res.json({ answers: localResponse })
  }
}
