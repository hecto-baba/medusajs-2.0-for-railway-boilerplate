import type { CreateProductOptionDTO } from "@medusajs/framework/types"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  createProductOptionsWorkflow,
  createRemoteLinkStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import { MARKETPLACE_MODULE } from "../modules/marketplace"

export type CreateVendorProductOptionWorkflowInput = {
  vendor_id?: string
  vendor_admin_id?: string
  product_option: CreateProductOptionDTO
}

export const createVendorProductOptionWorkflow = createWorkflow(
  "create-vendor-product-option",
  (input: CreateVendorProductOptionWorkflowInput) => {
    const optionData = transform({ input }, (data) => ({
      product_options: [data.input.product_option],
    }))

    const createdOptions = createProductOptionsWorkflow.runAsStep({
      input: optionData,
    })

    const { data: vendorAdmins } = useQueryGraphStep({
      entity: "vendor_admin",
      fields: ["vendor.id"],
      filters: { id: input.vendor_admin_id },
    }).config({ name: "retrieve-vendor-admins" })

    const linksToCreate = transform(
      { input, createdOptions, vendorAdmins },
      (data) => {
        const vendorId =
          data.input.vendor_id || data.vendorAdmins?.[0]?.vendor?.id
        if (!vendorId) {
          throw new Error("Cannot link product option: Authenticated vendor profile does not exist.")
        }
        return data.createdOptions.map((opt) => ({
          [MARKETPLACE_MODULE]: {
            vendor_id: vendorId,
          },
          [Modules.PRODUCT]: {
            product_option_id: opt.id,
          },
        }))
      }
    )

    createRemoteLinkStep(linksToCreate)

    const { data: productOptions } = useQueryGraphStep({
      entity: "product_option",
      fields: [
        "id",
        "title",
        "product_id",
        "values.*",
        "product.*",
        "created_at",
        "updated_at",
      ],
      filters: { id: createdOptions[0].id },
    }).config({ name: "retrieve-created-product-option" })

    return new WorkflowResponse({ product_option: productOptions[0] })
  }
)
