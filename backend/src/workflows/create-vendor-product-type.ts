import type { CreateProductTypeDTO } from "@medusajs/framework/types"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  createProductTypesWorkflow,
  createRemoteLinkStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import { MARKETPLACE_MODULE } from "../modules/marketplace"

export type CreateVendorProductTypeWorkflowInput = {
  vendor_id?: string
  vendor_admin_id?: string
  product_type: CreateProductTypeDTO
}

export const createVendorProductTypeWorkflow = createWorkflow(
  "create-vendor-product-type",
  (input: CreateVendorProductTypeWorkflowInput) => {
    const typeData = transform({ input }, (data) => ({
      product_types: [data.input.product_type],
    }))

    const createdProductTypes = createProductTypesWorkflow.runAsStep({
      input: typeData,
    })

    const { data: vendorAdmins } = useQueryGraphStep({
      entity: "vendor_admin",
      fields: ["vendor.id"],
      filters: { id: input.vendor_admin_id },
    }).config({ name: "retrieve-vendor-admins-for-product-type" })

    const linksToCreate = transform(
      { input, createdProductTypes, vendorAdmins },
      (data) => {
        const vendorId =
          data.input.vendor_id || data.vendorAdmins?.[0]?.vendor?.id
        if (!vendorId) {
          throw new Error("Cannot link product type: Authenticated vendor profile does not exist.")
        }
        return data.createdProductTypes.map((pt) => ({
          [MARKETPLACE_MODULE]: {
            vendor_id: vendorId,
          },
          [Modules.PRODUCT]: {
            product_type_id: pt.id,
          },
        }))
      }
    )

    createRemoteLinkStep(linksToCreate)

    const { data: productTypes } = useQueryGraphStep({
      entity: "product_type",
      fields: ["id", "value", "metadata", "created_at", "updated_at"],
      filters: { id: createdProductTypes[0].id },
    }).config({ name: "retrieve-created-vendor-product-type" })

    return new WorkflowResponse({ product_type: productTypes[0] })
  }
)
