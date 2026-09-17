import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { getVendorId } from "../../shared/vendor-scope"
import { onboardingStore } from "../../../../lib/onboarding-store"
import {
  fetchOnboardingStatus,
  resolveTaxonomyDetails,
  type TrustClawOnboardingStatus,
} from "../../../../lib/trustclaw"

/**
 * Returns the onboarding application status for the calling vendor.
 * Uses persistent local onboarding store backed by TrustClaw metadata.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const vendorId = await getVendorId(req)
  const localRecord = onboardingStore.get(vendorId)

  // Resolve taxonomy details dynamically
  const resolved = await resolveTaxonomyDetails({
    segmentId: localRecord.segmentId,
    vendorTypeId: localRecord.vendorTypeId,
    vendorCategoryId: localRecord.vendorCategoryId,
  })

  const segment = localRecord.segment || resolved.segment || null
  const vendorType = localRecord.vendorType || resolved.vendorType || null
  const vendorCategory = localRecord.vendorCategory || resolved.vendorCategory || null

  try {
    const remote = await fetchOnboardingStatus(vendorId).catch(() => null)

    const statusResult: TrustClawOnboardingStatus = {
      status: (remote?.status || localRecord.status || "DRAFT") as any,
      currentStep: remote?.currentStep || localRecord.currentStep || "SEGMENT_SELECTION",
      completedSteps:
        remote?.completedSteps?.length
          ? remote.completedSteps
          : localRecord.completedSteps,
      segmentId: remote?.segmentId || localRecord.segmentId || segment?.id || null,
      vendorTypeId: remote?.vendorTypeId || localRecord.vendorTypeId || vendorType?.id || null,
      vendorCategoryId: remote?.vendorCategoryId || localRecord.vendorCategoryId || vendorCategory?.id || null,
      segment: remote?.segment || segment || null,
      vendorType: remote?.vendorType || vendorType || null,
      vendorCategory: remote?.vendorCategory || vendorCategory || null,
      vendorId,
      rejectionReason:
        remote?.rejectionReason || localRecord.rejectionReason || undefined,
      feedback: remote?.feedback || localRecord.feedback || undefined,
      submittedAt: remote?.submittedAt || localRecord.submittedAt || undefined,
      canEdit: localRecord.status !== "APPROVED" && localRecord.status !== "UNDER_REVIEW",
    }

    res.json({ onboarding: statusResult })
  } catch {
    const fallbackStatus: TrustClawOnboardingStatus = {
      status: localRecord.status || "DRAFT",
      currentStep: localRecord.currentStep || "SEGMENT_SELECTION",
      completedSteps: localRecord.completedSteps || [],
      segmentId: localRecord.segmentId || segment?.id || null,
      vendorTypeId: localRecord.vendorTypeId || vendorType?.id || null,
      vendorCategoryId: localRecord.vendorCategoryId || vendorCategory?.id || null,
      segment: segment || null,
      vendorType: vendorType || null,
      vendorCategory: vendorCategory || null,
      vendorId,
      rejectionReason: localRecord.rejectionReason || undefined,
      feedback: localRecord.feedback || undefined,
      submittedAt: localRecord.submittedAt || undefined,
      canEdit: localRecord.status !== "APPROVED" && localRecord.status !== "UNDER_REVIEW",
    }
    res.json({ onboarding: fallbackStatus })
  }
}
