import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { PRODUCT_ENQUIRY_MODULE } from "../../modules/product-enquiry"
import ProductEnquiryModuleService from "../../modules/product-enquiry/service"
import { EnquiryFieldAnswers, EnquiryFieldDefinition } from "../../utils/enquiry-field"

type CreateEnquiryInput = {
  product_id: string
  customer_email: string
  message: string
  customer_id?: string | null
  custom_field_answers?: EnquiryFieldAnswers | null
  /** The configuration's custom_fields at submission time - see enquiry.ts model comment. */
  custom_fields_snapshot?: EnquiryFieldDefinition[] | null
}

export const createEnquiryStep = createStep(
  "create-enquiry",
  async (input: CreateEnquiryInput, { container }) => {
    const productEnquiryModuleService: ProductEnquiryModuleService =
      container.resolve(PRODUCT_ENQUIRY_MODULE)

    const enquiry = await productEnquiryModuleService.createEnquiries({
      product_id: input.product_id,
      customer_email: input.customer_email,
      message: input.message,
      customer_id: input.customer_id ?? null,
      custom_field_answers: input.custom_field_answers ?? null,
      custom_fields_snapshot: input.custom_fields_snapshot ?? null,
      status: "pending",
    })

    return new StepResponse(enquiry, enquiry.id)
  },
  async (enquiryId, { container }) => {
    if (!enquiryId) return

    const productEnquiryModuleService: ProductEnquiryModuleService =
      container.resolve(PRODUCT_ENQUIRY_MODULE)

    await productEnquiryModuleService.deleteEnquiries(enquiryId)
  }
)
