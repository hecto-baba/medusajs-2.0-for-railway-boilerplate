import type { CreateProductTagDTO } from "@medusajs/framework/types"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  createProductTagsWorkflow,
  createRemoteLinkStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import { MARKETPLACE_MODULE } from "../modules/marketplace"

export type CreateVendorProductTagWorkflowInput = {
  vendor_id?: string
  vendor_admin_id?: string
  product_tag: CreateProductTagDTO
}

export const createVendorProductTagWorkflow = createWorkflow(
  "create-vendor-product-tag",
  (input: CreateVendorProductTagWorkflowInput) => {
    const tagData = transform({ input }, (data) => ({
      product_tags: [data.input.product_tag],
    }))

    const createdProductTags = createProductTagsWorkflow.runAsStep({
      input: tagData,
    })

    const { data: vendorAdmins } = useQueryGraphStep({
      entity: "vendor_admin",
      fields: ["vendor.id"],
      filters: { id: input.vendor_admin_id },
    }).config({ name: "retrieve-vendor-admins-for-product-tag" })

    const linksToCreate = transform(
      { input, createdProductTags, vendorAdmins },
      (data) => {
        const vendorId =
          data.input.vendor_id || data.vendorAdmins?.[0]?.vendor?.id
        if (!vendorId) {
          throw new Error("Cannot link product tag: Authenticated vendor profile does not exist.")
        }
        return data.createdProductTags.map((pt) => ({
          [MARKETPLACE_MODULE]: {
            vendor_id: vendorId,
          },
          [Modules.PRODUCT]: {
            product_tag_id: pt.id,
          },
        }))
      }
    )

    createRemoteLinkStep(linksToCreate)

    const { data: productTags } = useQueryGraphStep({
      entity: "product_tag",
      fields: ["id", "value", "metadata", "created_at", "updated_at"],
      filters: { id: createdProductTags[0].id },
    }).config({ name: "retrieve-created-vendor-product-tag" })

    return new WorkflowResponse({ product_tag: productTags[0] })
  }
)
