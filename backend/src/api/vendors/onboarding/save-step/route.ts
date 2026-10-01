import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { getVendorId } from "../../shared/vendor-scope"
import { onboardingStore } from "../../../../lib/onboarding-store"
import {
  saveOnboardingStep,
  type TrustClawSaveStepPayload,
} from "../../../../lib/trustclaw"

/**
 * Saves draft answers for a specific onboarding step.
 * Injects vendor.id from the authenticated session.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const vendorId = await getVendorId(req)
  const body = (req.validatedBody ?? req.body) as Partial<TrustClawSaveStepPayload> & {
    segment?: { id: string; name: string; code: string }
    vendorType?: { id: string; name: string; code: string }
    vendorCategory?: { id: string; name: string; code: string }
  }

  if (!body.step) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "The 'step' field is required when saving onboarding progress."
    )
  }

  // 1. Save in local persistent onboarding store
  const updatedRecord = onboardingStore.saveStep(
    vendorId,
    String(body.step),
    (body.answers as Record<string, any>) || {},
    {
      segmentId: body.segmentId,
      vendorTypeId: body.vendorTypeId,
      vendorCategoryId: body.vendorCategoryId,
      segment: body.segment,
      vendorType: body.vendorType,
      vendorCategory: body.vendorCategory,
    }
  )

  // 2. Try saving upstream to TrustClaw if supported step
  const tcSteps = ["IDENTITY", "LOCATION", "OPERATIONS", "CONTACT", "KYC", "SHOWCASE"]
  if (tcSteps.includes(String(body.step))) {
    try {
      await saveOnboardingStep({
        vendorId,
        step: body.step,
        answers: body.answers ?? {},
        segmentId: body.segmentId,
        vendorTypeId: body.vendorTypeId,
        vendorCategoryId: body.vendorCategoryId,
      })
    } catch {
      // TrustClaw remote save failure is non-blocking
    }
  }

  res.json({
    result: {
      success: true,
      savedStep: String(body.step),
      completedSteps: updatedRecord.completedSteps,
    },
  })
}
