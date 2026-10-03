import {
  createWorkflow,
  WorkflowResponse,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep, createRemoteLinkStep } from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import { createEoiConfigurationStep } from "./steps/create-eoi-configuration"
import { updateEoiConfigurationStep } from "./steps/update-eoi-configuration"
import { EOI_MODULE } from "../modules/expression-of-interest"

type UpsertEoiConfigWorkflowInput = {
  product_id: string
  value_type?: "fixed" | "percentage"
  value_amount?: number
  status?: "active" | "inactive"
}

/**
 * Mirrors upsert-rental-config.ts: find existing config by product_id,
 * branch create vs. update, link on first creation only.
 */
export const upsertEoiConfigWorkflow = createWorkflow(
  "upsert-eoi-config",
  (input: UpsertEoiConfigWorkflowInput) => {
    const { data: products } = useQueryGraphStep({
      entity: "product",
      fields: ["id", "eoi_configuration.*"],
      filters: { id: input.product_id },
      options: {
        throwIfKeyNotFound: true,
      },
    }).config({ name: "retrieve-product-eoi-config" })

    const createdConfig = when({ products }, (data) => {
      return !data.products[0]?.eoi_configuration
    }).then(() => {
      const newConfig = createEoiConfigurationStep({
        product_id: input.product_id,
        value_type: input.value_type,
        value_amount: input.value_amount,
        status: input.status,
      })

      const linkData = transform({ newConfig, product_id: input.product_id }, (data) => {
        return [
          {
            [Modules.PRODUCT]: {
              product_id: data.product_id,
            },
            [EOI_MODULE]: {
              eoi_configuration_id: data.newConfig.id,
            },
          },
        ]
      })

      createRemoteLinkStep(linkData)

      return newConfig
    })

    // @ts-ignore
    const updatedConfig = when({ products }, (data) => {
      return !!data.products[0]?.eoi_configuration
    }).then(() => {
      return updateEoiConfigurationStep({
        id: products[0].eoi_configuration!.id,
        value_type: input.value_type,
        value_amount: input.value_amount,
        status: input.status,
      })
    })

    const eoiConfig = transform({ updatedConfig, createdConfig }, (data) => {
      return data.updatedConfig || data.createdConfig
    })

    return new WorkflowResponse(eoiConfig)
  }
)
