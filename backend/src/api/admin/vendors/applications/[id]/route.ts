import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { onboardingStore } from "../../../../../lib/onboarding-store"
import {
  fetchOnboardingAnswers,
  fetchOnboardingStatus,
  resolveTaxonomyDetails,
} from "../../../../../lib/trustclaw"

/**
 * GET /admin/vendors/applications/:id
 *
 * Fetches the complete submitted answers and verification details for a vendor application.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id: vendorId } = req.params
  const localRecord = onboardingStore.get(vendorId)

  const resolved = await resolveTaxonomyDetails({
    segmentId: localRecord.segmentId,
    vendorTypeId: localRecord.vendorTypeId,
    vendorCategoryId: localRecord.vendorCategoryId,
  })

  const segment = resolved.segment || localRecord.segment || null
  const vendorType = resolved.vendorType || localRecord.vendorType || null
  const vendorCategory = resolved.vendorCategory || localRecord.vendorCategory || null

  try {
    const [remoteStatus, remoteAnswers] = await Promise.all([
      fetchOnboardingStatus(vendorId).catch(() => null),
      fetchOnboardingAnswers(vendorId).catch(() => null),
    ])

    res.json({
      application: {
        vendorId,
        vendorName: localRecord.vendorName,
        status: (remoteStatus?.status || localRecord.status || "DRAFT") as any,
        segment: remoteStatus?.segment || segment,
        vendorType: remoteStatus?.vendorType || vendorType,
        vendorCategory: remoteStatus?.vendorCategory || vendorCategory,
        completedSteps:
          remoteStatus?.completedSteps?.length
            ? remoteStatus.completedSteps
            : localRecord.completedSteps || [],
        rejectionReason:
          remoteStatus?.rejectionReason || localRecord.rejectionReason || null,
        feedback: remoteStatus?.feedback || localRecord.feedback || null,
        submittedAt: remoteStatus?.submittedAt || localRecord.submittedAt || null,
        answers: {
          ...(localRecord.answers || {}),
          ...(remoteAnswers?.answers || {}),
        },
      },
    })
  } catch {
    res.json({
      application: {
        vendorId,
        vendorName: localRecord.vendorName,
        status: localRecord.status || "DRAFT",
        segment: segment,
        vendorType: vendorType,
        vendorCategory: vendorCategory,
        completedSteps: localRecord.completedSteps || [],
        rejectionReason: localRecord.rejectionReason || null,
        feedback: localRecord.feedback || null,
        submittedAt: localRecord.submittedAt || null,
        answers: localRecord.answers || {},
      },
    })
  }
}
