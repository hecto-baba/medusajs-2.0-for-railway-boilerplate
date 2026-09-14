import type { CreateOrderReturnReasonDTO } from "@medusajs/framework/types"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  createReturnReasonsWorkflow,
  createRemoteLinkStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import { MARKETPLACE_MODULE } from "../modules/marketplace"

export type CreateVendorReturnReasonWorkflowInput = {
  vendor_admin_id: string
  data: CreateOrderReturnReasonDTO
}

/**
 * Creates a return reason and links it to the vendor behind the calling
 * admin. Mirrors create-vendor-product.ts: without the link step, the row
 * exists and is visible in the Medusa admin, but is invisible to its own
 * vendor forever - no ownership check will ever pass for it.
 */
export const createVendorReturnReasonWorkflow = createWorkflow(
  "create-vendor-return-reason",
  (input: CreateVendorReturnReasonWorkflowInput) => {
    const created = createReturnReasonsWorkflow.runAsStep({
      input: { data: [input.data] },
    })

    const { data: vendorAdmins } = useQueryGraphStep({
      entity: "vendor_admin",
      fields: ["vendor.id"],
      filters: { id: input.vendor_admin_id },
    }).config({ name: "retrieve-vendor-admins" })

    const linksToCreate = transform({ created, vendorAdmins }, (data) => [
      {
        [MARKETPLACE_MODULE]: { vendor_id: data.vendorAdmins[0].vendor.id },
        [Modules.ORDER]: { return_reason_id: data.created[0].id },
      },
    ])

    createRemoteLinkStep(linksToCreate)

    return new WorkflowResponse({ return_reason: created[0] })
  }
)
