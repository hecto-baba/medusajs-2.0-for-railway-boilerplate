import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  fetchOnboardingQuestions,
  type TrustClawQuestionSet,
} from "../../../../lib/trustclaw"

/**
 * Returns dynamic question definitions for an onboarding step, vertical, or vendor category.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { vendorCategoryId, step, segmentId, vendorTypeId } =
    req.query as Record<string, string | undefined>

  try {
    const questions = await fetchOnboardingQuestions({
      vendorCategoryId,
      step,
      segmentId,
      vendorTypeId,
    })
    res.json({ questions })
  } catch {
    res.json({ questions: [] })
  }
}
