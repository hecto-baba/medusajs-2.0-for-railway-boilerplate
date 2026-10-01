import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { EnquiryFieldAnswers, EnquiryFieldDefinition } from "../../utils/enquiry-field"
import { validateEnquiryFieldAnswers } from "../../utils/validate-enquiry-fields"

type EnquiryConfigLike = {
  status: "active" | "inactive"
  custom_fields: EnquiryFieldDefinition[] | null
} | null | undefined

type ValidateEnquirySubmissionInput = {
  enquiry_configuration: EnquiryConfigLike
  custom_field_answers?: EnquiryFieldAnswers | null
}

/**
 * The actual enforcement point for "opt-in per product" (see
 * docs/plan/PRODUCT_ENQUIRY_MODULE_PLAN_ADMIN2.md, Phase C.2). No
 * compensation needed - this step only validates, it makes no writes to
 * roll back.
 */
export const validateEnquirySubmissionStep = createStep(
  "validate-enquiry-submission",
  async (input: ValidateEnquirySubmissionInput) => {
    const config = input.enquiry_configuration

    if (!config || config.status !== "active") {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "This product is not currently accepting enquiries."
      )
    }

    const fields = config.custom_fields ?? []
    validateEnquiryFieldAnswers(fields, input.custom_field_answers)

    return new StepResponse(fields)
  }
)
