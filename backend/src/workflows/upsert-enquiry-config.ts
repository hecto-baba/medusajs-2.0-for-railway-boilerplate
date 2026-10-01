import {
  createWorkflow,
  WorkflowResponse,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep, createRemoteLinkStep } from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import { createEnquiryConfigurationStep } from "./steps/create-enquiry-configuration"
import { updateEnquiryConfigurationStep } from "./steps/update-enquiry-configuration"
import { PRODUCT_ENQUIRY_MODULE } from "../modules/product-enquiry"
import { EnquiryFieldDefinition } from "../utils/enquiry-field"

type UpsertEnquiryConfigWorkflowInput = {
  product_id: string
  status?: "active" | "inactive"
  custom_fields?: EnquiryFieldDefinition[] | null
}

/**
 * Mirrors upsert-rental-config.ts: check for an existing configuration via
 * the product link, create-and-link if none exists, update in place if one
 * does. First call (no existing config) is what "Enable Enquiries" in the
 * widget triggers.
 */
export const upsertEnquiryConfigWorkflow = createWorkflow(
  "upsert-enquiry-config",
  (input: UpsertEnquiryConfigWorkflowInput) => {
    const { data: products } = useQueryGraphStep({
      entity: "product",
      fields: ["id", "enquiry_configuration.*"],
      filters: { id: input.product_id },
      options: {
        throwIfKeyNotFound: true,
      },
    }).config({ name: "retrieve-product-enquiry-config" })

    const createdConfig = when({ products }, (data) => {
      return !data.products[0]?.enquiry_configuration
    }).then(() => {
      const newConfig = createEnquiryConfigurationStep({
        product_id: input.product_id,
        status: input.status,
        custom_fields: input.custom_fields,
      })

      const linkData = transform({ newConfig, product_id: input.product_id }, (data) => {
        return [
          {
            [Modules.PRODUCT]: {
              product_id: data.product_id,
            },
            [PRODUCT_ENQUIRY_MODULE]: {
              enquiry_configuration_id: data.newConfig.id,
            },
          },
        ]
      })

      createRemoteLinkStep(linkData)

      return newConfig
    })

    // @ts-ignore
    const updatedConfig = when({ products }, (data) => {
      return !!data.products[0]?.enquiry_configuration
    }).then(() => {
      return updateEnquiryConfigurationStep({
        id: products[0].enquiry_configuration!.id,
        status: input.status,
        custom_fields: input.custom_fields,
      })
    })

    const enquiryConfig = transform({ updatedConfig, createdConfig }, (data) => {
      return data.updatedConfig || data.createdConfig
    })

    return new WorkflowResponse(enquiryConfig)
  }
)
