import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  fetchOnboardingQuestions,
  type TrustClawQuestionSet,
} from "../../../../lib/trustclaw"
import { getVendorId } from "../../shared/vendor-scope"
import { onboardingStore } from "../../../../lib/onboarding-store"

/**
 * Returns dynamic question definitions for an onboarding step, vertical, or vendor category.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const {
    vendorCategoryId,
    vendorCategoryCode,
    step,
    segmentId,
    vendorTypeId,
  } = req.query as Record<string, string | undefined>

  let effectiveVendorCategoryId = vendorCategoryId
  let effectiveVendorCategoryCode = vendorCategoryCode
  let effectiveSegmentId = segmentId
  let effectiveVendorTypeId = vendorTypeId

  // If vendor category is not explicitly passed in query params, resolve from vendor's onboarding state
  if (!effectiveVendorCategoryId && !effectiveVendorCategoryCode) {
    try {
      const vendorId = await getVendorId(req)
      const localRecord = onboardingStore.get(vendorId)
      if (localRecord?.vendorCategory?.code) {
        effectiveVendorCategoryCode = localRecord.vendorCategory.code
      } else if (localRecord?.vendorCategoryId) {
        effectiveVendorCategoryId = localRecord.vendorCategoryId
      }
      if (!effectiveSegmentId && localRecord?.segmentId) {
        effectiveSegmentId = localRecord.segmentId
      }
      if (!effectiveVendorTypeId && localRecord?.vendorTypeId) {
        effectiveVendorTypeId = localRecord.vendorTypeId
      }
    } catch {
      // Non-fatal if unauthenticated or admin
    }
  }

  try {
    const questions = await fetchOnboardingQuestions({
      vendorCategoryId: effectiveVendorCategoryId,
      vendorCategoryCode: effectiveVendorCategoryCode,
      step,
      segmentId: effectiveSegmentId,
      vendorTypeId: effectiveVendorTypeId,
    })
    res.json({ questions })
  } catch (err: any) {
    res.json({ questions: [] })
  }
}

