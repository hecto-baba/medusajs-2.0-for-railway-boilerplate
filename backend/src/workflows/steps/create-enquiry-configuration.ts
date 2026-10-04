import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { PRODUCT_ENQUIRY_MODULE } from "../../modules/product-enquiry"
import ProductEnquiryModuleService from "../../modules/product-enquiry/service"
import { EnquiryFieldDefinition } from "../../utils/enquiry-field"
import { assertNoOtherSaleMode, withSaleModeLock } from "../../lib/sale-mode"
import { validateEnquiryFieldDefinitions } from "../../utils/validate-enquiry-fields"

type CreateEnquiryConfigurationInput = {
  product_id: string
  status?: "active" | "inactive"
  custom_fields?: EnquiryFieldDefinition[] | null
}

export const createEnquiryConfigurationStep = createStep(
  "create-enquiry-configuration",
  async (input: CreateEnquiryConfigurationInput, { container }) => {
    if (input.custom_fields?.length) {
      validateEnquiryFieldDefinitions(input.custom_fields)
    }

    const productEnquiryModuleService: ProductEnquiryModuleService =
      container.resolve(PRODUCT_ENQUIRY_MODULE)

    const write = () =>
      productEnquiryModuleService.createEnquiryConfigurations({
        product_id: input.product_id,
        status: input.status ?? "active",
        custom_fields: input.custom_fields ?? null,
      })

    try {
      // One sale mode per product: enabling enquiries (the default here) is
      // refused while rental, appointment, EOI or ticketing is active. The
      // check and the write share one lock so another mode cannot switch on
      // between them.
      const config =
        input.status !== "inactive"
          ? await withSaleModeLock(container, [input.product_id], async () => {
              await assertNoOtherSaleMode(container, input.product_id, "enquiry")
              return write()
            })
          : await write()

      return new StepResponse(config, config.id)
    } catch (error) {
      // The unique index (Migration20260919180000_enquiry_config_unique_product)
      // is the actual guard against two concurrent "Enable Enquiries" calls
      // creating duplicate rows for one product (upsertEnquiryConfigWorkflow's
      // own read-then-write has a gap - see that workflow's comment). A clean
      // error here beats letting a raw Postgres constraint-violation message
      // reach the admin UI.
      if (error?.code === "23505" || /duplicate key|unique constraint/i.test(error?.message ?? "")) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "This product's enquiry settings were just created by another request - refresh and try again."
        )
      }
      throw error
    }
  },
  async (configId, { container }) => {
    if (!configId) return

    const productEnquiryModuleService: ProductEnquiryModuleService =
      container.resolve(PRODUCT_ENQUIRY_MODULE)

    await productEnquiryModuleService.deleteEnquiryConfigurations(configId)
  }
)
