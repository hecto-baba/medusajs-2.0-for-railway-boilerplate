import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { PRODUCT_ENQUIRY_MODULE } from "../../modules/product-enquiry"
import ProductEnquiryModuleService from "../../modules/product-enquiry/service"

type UpdateEnquiryStatusInput = {
  enquiry_id: string
  status: "pending" | "closed"
}

/**
 * Generic status setter for the two transitions that don't involve a reply
 * ("responded" is only reachable via respond-to-enquiry.ts, so a reply
 * always implies the enquiry.responded event fires).
 */
export const updateEnquiryStatusStep = createStep(
  "update-enquiry-status",
  async ({ enquiry_id, status }: UpdateEnquiryStatusInput, { container }) => {
    const productEnquiryModuleService: ProductEnquiryModuleService =
      container.resolve(PRODUCT_ENQUIRY_MODULE)

    const existingEnquiry = await productEnquiryModuleService.retrieveEnquiry(enquiry_id)

    if (existingEnquiry.status === "responded" && status === "pending") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Can't move a responded enquiry back to pending."
      )
    }

    const updatedEnquiry = await productEnquiryModuleService.updateEnquiries({
      id: enquiry_id,
      status,
    })

    return new StepResponse(updatedEnquiry, existingEnquiry)
  },
  async (existingEnquiry, { container }) => {
    if (!existingEnquiry) return

    const productEnquiryModuleService: ProductEnquiryModuleService =
      container.resolve(PRODUCT_ENQUIRY_MODULE)

    await productEnquiryModuleService.updateEnquiries({
      id: existingEnquiry.id,
      status: existingEnquiry.status,
    })
  }
)
