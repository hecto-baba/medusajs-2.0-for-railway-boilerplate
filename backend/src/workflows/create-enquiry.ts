import {
  createWorkflow,
  WorkflowResponse,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep, createRemoteLinkStep, emitEventStep } from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import { createEnquiryStep } from "./steps/create-enquiry"
import { validateEnquirySubmissionStep } from "./steps/validate-enquiry-submission"
import { PRODUCT_ENQUIRY_MODULE } from "../modules/product-enquiry"
import { EnquiryFieldAnswers } from "../utils/enquiry-field"

type CreateEnquiryWorkflowInput = {
  product_id: string
  customer_email: string
  message: string
  customer_id?: string | null
  custom_field_answers?: EnquiryFieldAnswers | null
}

export const createEnquiryWorkflow = createWorkflow(
  "create-enquiry",
  (input: CreateEnquiryWorkflowInput) => {
    // Validate the product exists before creating an enquiry for it - fails
    // fast rather than creating an orphaned row with no linkable product.
    // Also fetches enquiry_configuration.* in the same query, since
    // validate-enquiry-submission needs it to enforce the per-product
    // enable gate (ADMIN2 addendum, Phase C.2).
    const { data: products } = useQueryGraphStep({
      entity: "product",
      fields: ["id", "enquiry_configuration.status", "enquiry_configuration.custom_fields"],
      filters: { id: input.product_id },
      options: {
        throwIfKeyNotFound: true,
      },
    }).config({ name: "retrieve-enquiry-product" })

    // Throws NOT_ALLOWED if the product has no active configuration, or
    // INVALID_DATA if a required/format rule on a custom field is violated.
    // @ts-ignore
    const fieldsSnapshot = validateEnquirySubmissionStep({
      enquiry_configuration: products[0]?.enquiry_configuration,
      custom_field_answers: input.custom_field_answers,
    })

    const enquiry = createEnquiryStep({
      product_id: input.product_id,
      customer_email: input.customer_email,
      message: input.message,
      customer_id: input.customer_id,
      custom_field_answers: input.custom_field_answers,
      custom_fields_snapshot: fieldsSnapshot,
    })

    // Always link the enquiry to its product, and additionally to the
    // customer when the enquiry was submitted by an authenticated one
    // (guest enquiries with customer_id null skip that link). Built as a
    // single array so createRemoteLinkStep only needs to run once - it
    // registers itself as a step named "create-remote-links", and calling
    // it a second time anywhere in this workflow throws
    // "Step create-remote-links is already defined in workflow".
    const linkData = transform(
      { enquiry, product_id: input.product_id, customer_id: input.customer_id },
      (data) => {
        const links: Record<string, Record<string, string>>[] = [
          {
            [Modules.PRODUCT]: {
              product_id: data.product_id,
            },
            [PRODUCT_ENQUIRY_MODULE]: {
              enquiry_id: data.enquiry.id,
            },
          },
        ]

        if (data.customer_id) {
          links.push({
            [Modules.CUSTOMER]: {
              customer_id: data.customer_id,
            },
            [PRODUCT_ENQUIRY_MODULE]: {
              enquiry_id: data.enquiry.id,
            },
          })
        }

        return links
      }
    )

    createRemoteLinkStep(linkData)

    // Lets the product's seller (or the platform) know a question is waiting.
    emitEventStep({
      eventName: "enquiry.created",
      data: transform({ enquiry }, (data) => ({ id: data.enquiry.id })),
    })

    return new WorkflowResponse(enquiry)
  }
)
