import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { PRODUCT_ENQUIRY_MODULE } from "../../modules/product-enquiry"
import ProductEnquiryModuleService from "../../modules/product-enquiry/service"
import { EnquiryFieldDefinition } from "../../utils/enquiry-field"
import { assertNoOtherSaleMode, withSaleModeLock } from "../../lib/sale-mode"
import { validateEnquiryFieldDefinitions } from "../../utils/validate-enquiry-fields"

type UpdateEnquiryConfigurationInput = {
  id: string
  status?: "active" | "inactive"
  custom_fields?: EnquiryFieldDefinition[] | null
}

export const updateEnquiryConfigurationStep = createStep(
  "update-enquiry-configuration",
  async (input: UpdateEnquiryConfigurationInput, { container }) => {
    if (input.custom_fields?.length) {
      validateEnquiryFieldDefinitions(input.custom_fields)
    }

    const productEnquiryModuleService: ProductEnquiryModuleService =
      container.resolve(PRODUCT_ENQUIRY_MODULE)

    const existingConfig = await productEnquiryModuleService.retrieveEnquiryConfiguration(
      input.id
    )

    const write = () =>
      productEnquiryModuleService.updateEnquiryConfigurations({
        id: input.id,
        status: input.status,
        custom_fields: input.custom_fields,
      })

    // Only a switch to "active" can create a conflict; re-saving fields on an
    // already-active config must keep working. Check and write share one lock.
    const updatedConfig =
      input.status === "active" && existingConfig.status !== "active"
        ? await withSaleModeLock(container, [existingConfig.product_id], async () => {
            await assertNoOtherSaleMode(container, existingConfig.product_id, "enquiry")
            return write()
          })
        : await write()

    return new StepResponse(updatedConfig, existingConfig)
  },
  async (existingConfig, { container }) => {
    if (!existingConfig) return

    const productEnquiryModuleService: ProductEnquiryModuleService =
      container.resolve(PRODUCT_ENQUIRY_MODULE)

    await productEnquiryModuleService.updateEnquiryConfigurations({
      id: existingConfig.id,
      status: existingConfig.status,
      custom_fields: existingConfig.custom_fields,
    })
  }
)
