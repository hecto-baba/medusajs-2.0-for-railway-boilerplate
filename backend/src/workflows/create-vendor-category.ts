import type { CreateProductCategoryDTO } from "@medusajs/framework/types"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  createProductCategoriesWorkflow,
  createRemoteLinkStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import { MARKETPLACE_MODULE } from "../modules/marketplace"

export type CreateVendorCategoryWorkflowInput = {
  vendor_id?: string
  vendor_admin_id?: string
  category: CreateProductCategoryDTO
}

export const createVendorCategoryWorkflow = createWorkflow(
  "create-vendor-category",
  (input: CreateVendorCategoryWorkflowInput) => {
    const categoryData = transform({ input }, (data) => ({
      product_categories: [data.input.category],
    }))

    const createdCategories = createProductCategoriesWorkflow.runAsStep({
      input: categoryData,
    })

    const { data: vendorAdmins } = useQueryGraphStep({
      entity: "vendor_admin",
      fields: ["vendor.id"],
      filters: { id: input.vendor_admin_id },
    }).config({ name: "retrieve-vendor-admins" })

    const linksToCreate = transform(
      { input, createdCategories, vendorAdmins },
      (data) => {
        const vendorId =
          data.input.vendor_id || data.vendorAdmins?.[0]?.vendor?.id
        if (!vendorId) {
          throw new Error("Cannot link category: Authenticated vendor profile does not exist.")
        }
        return data.createdCategories.map((cat) => ({
          [MARKETPLACE_MODULE]: {
            vendor_id: vendorId,
          },
          [Modules.PRODUCT]: {
            product_category_id: cat.id,
          },
        }))
      }
    )

    createRemoteLinkStep(linksToCreate)

    const { data: categories } = useQueryGraphStep({
      entity: "product_category",
      fields: [
        "id",
        "name",
        "handle",
        "description",
        "is_active",
        "is_internal",
        "parent_category_id",
        "parent_category.*",
        "category_children.*",
        "products.*",
        "created_at",
        "updated_at",
      ],
      filters: { id: createdCategories[0].id },
    }).config({ name: "retrieve-created-category" })

    return new WorkflowResponse({ category: categories[0] })
  }
)
