import type { CreateProductCollectionDTO } from "@medusajs/framework/types"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  createCollectionsWorkflow,
  createRemoteLinkStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import { MARKETPLACE_MODULE } from "../modules/marketplace"

export type CreateVendorCollectionWorkflowInput = {
  vendor_id?: string
  vendor_admin_id?: string
  collection: CreateProductCollectionDTO
}

export const createVendorCollectionWorkflow = createWorkflow(
  "create-vendor-collection",
  (input: CreateVendorCollectionWorkflowInput) => {
    const collectionData = transform({ input }, (data) => ({
      collections: [data.input.collection],
    }))

    const createdCollections = createCollectionsWorkflow.runAsStep({
      input: collectionData,
    })

    const { data: vendorAdmins } = useQueryGraphStep({
      entity: "vendor_admin",
      fields: ["vendor.id"],
      filters: { id: input.vendor_admin_id },
    }).config({ name: "retrieve-vendor-admins" })

    const linksToCreate = transform(
      { input, createdCollections, vendorAdmins },
      (data) => {
        const vendorId =
          data.input.vendor_id || data.vendorAdmins?.[0]?.vendor?.id
        if (!vendorId) {
          throw new Error("Cannot link collection: Authenticated vendor profile does not exist.")
        }
        return data.createdCollections.map((col) => ({
          [MARKETPLACE_MODULE]: {
            vendor_id: vendorId,
          },
          [Modules.PRODUCT]: {
            product_collection_id: col.id,
          },
        }))
      }
    )

    createRemoteLinkStep(linksToCreate)

    const { data: collections } = useQueryGraphStep({
      entity: "product_collection",
      fields: ["id", "title", "handle", "metadata", "created_at", "updated_at", "products.*"],
      filters: { id: createdCollections[0].id },
    }).config({ name: "retrieve-created-collection" })

    return new WorkflowResponse({ collection: collections[0] })
  }
)
