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

    // A reply is final. Without this, responded -> closed -> pending would
    // re-open an answered enquiry, and respond-to-enquiry would then overwrite
    // the reply and email the customer a second time.
    if (status === "pending" && (existingEnquiry.reply || existingEnquiry.responded_at)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Can't re-open an enquiry that has already been answered."
      )
    }

    // Selector-scoped write (same pattern as respond-to-enquiry.ts): only
    // applies if the status is still what we just read, so a reply landing
    // between our read and our write can't be silently overwritten.
    const updatedEnquiries = await productEnquiryModuleService.updateEnquiries({
      selector: { id: enquiry_id, status: existingEnquiry.status },
      data: { status },
    })

    const updatedEnquiry = Array.isArray(updatedEnquiries) ? updatedEnquiries[0] : updatedEnquiries

    if (!updatedEnquiry) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "This enquiry was changed by someone else just now - refresh and try again."
      )
    }

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
