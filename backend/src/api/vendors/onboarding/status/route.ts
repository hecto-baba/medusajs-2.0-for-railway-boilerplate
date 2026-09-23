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
  const localRecord = await onboardingStore.getAsync(vendorId)

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

    const effectiveStatus = (localRecord.status && localRecord.status !== "DRAFT")
      ? localRecord.status
      : (remote?.status || localRecord.status || "DRAFT")

    const statusResult: TrustClawOnboardingStatus = {
      status: effectiveStatus as any,
      currentStep: remote?.currentStep || localRecord.currentStep || "SEGMENT_SELECTION",
      completedSteps:
        localRecord.completedSteps?.length
          ? localRecord.completedSteps
          : remote?.completedSteps || [],
      segmentId: localRecord.segmentId || remote?.segmentId || segment?.id || null,
      vendorTypeId: localRecord.vendorTypeId || remote?.vendorTypeId || vendorType?.id || null,
      vendorCategoryId: localRecord.vendorCategoryId || remote?.vendorCategoryId || vendorCategory?.id || null,
      segment: segment || remote?.segment || null,
      vendorType: vendorType || remote?.vendorType || null,
      vendorCategory: vendorCategory || remote?.vendorCategory || null,
      vendorId,
      rejectionReason:
        localRecord.rejectionReason || remote?.rejectionReason || undefined,
      feedback: localRecord.feedback || remote?.feedback || undefined,
      submittedAt: localRecord.submittedAt || remote?.submittedAt || undefined,
      canEdit: effectiveStatus !== "APPROVED" && effectiveStatus !== "UNDER_REVIEW" && effectiveStatus !== "SUBMITTED",
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
      canEdit: localRecord.status !== "APPROVED" && localRecord.status !== "UNDER_REVIEW" && localRecord.status !== "SUBMITTED",
    }
    res.json({ onboarding: fallbackStatus })
  }
}
