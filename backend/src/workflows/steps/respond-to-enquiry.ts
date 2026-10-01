import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { PRODUCT_ENQUIRY_MODULE } from "../../modules/product-enquiry"
import ProductEnquiryModuleService from "../../modules/product-enquiry/service"

type RespondToEnquiryInput = {
  enquiry_id: string
  reply: string
}

export const respondToEnquiryStep = createStep(
  "respond-to-enquiry",
  async ({ enquiry_id, reply }: RespondToEnquiryInput, { container }) => {
    const productEnquiryModuleService: ProductEnquiryModuleService =
      container.resolve(PRODUCT_ENQUIRY_MODULE)

    const existingEnquiry = await productEnquiryModuleService.retrieveEnquiry(enquiry_id)

    if (existingEnquiry.status !== "pending") {
      // Covers both "closed" (never repliable) and "responded" (already
      // answered - replying again would silently overwrite the first reply
      // and re-email the customer). See docs/plan/PRODUCT_ENQUIRY_MODULE_PLAN_ADMIN2.md
      // audit findings.
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        existingEnquiry.status === "responded"
          ? "This enquiry has already been answered."
          : "Can't respond to an enquiry that has been closed."
      )
    }

    // Selector-scoped update, not update-by-id: only writes if the row is
    // STILL "pending" at write time, closing the two-admin-tabs race the
    // status check above alone can't - both tabs could pass that check
    // before either writes. An empty result here means someone else's
    // reply landed first between our check and our write.
    const updatedEnquiries = await productEnquiryModuleService.updateEnquiries({
      selector: { id: enquiry_id, status: "pending" },
      data: {
        reply,
        status: "responded",
        responded_at: new Date(),
      },
    })

    const updatedEnquiry = Array.isArray(updatedEnquiries) ? updatedEnquiries[0] : updatedEnquiries

    if (!updatedEnquiry) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "This enquiry was already answered by someone else just now - refresh and check the reply."
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
      reply: existingEnquiry.reply,
      status: existingEnquiry.status,
      responded_at: existingEnquiry.responded_at,
    })
  }
)
