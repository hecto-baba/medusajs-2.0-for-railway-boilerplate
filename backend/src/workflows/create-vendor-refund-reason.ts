import type { CreateRefundReasonDTO } from "@medusajs/framework/types"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  createRefundReasonsWorkflow,
  createRemoteLinkStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import { MARKETPLACE_MODULE } from "../modules/marketplace"

export type CreateVendorRefundReasonWorkflowInput = {
  vendor_admin_id: string
  data: CreateRefundReasonDTO
}

/**
 * Creates a refund reason and links it to the vendor behind the calling
 * admin. Mirrors create-vendor-return-reason.ts; RefundReason lives in the
 * Payment module, confirmed via PaymentModule.linkable at runtime the same
 * way ReturnReason was confirmed on the Order module.
 */
export const createVendorRefundReasonWorkflow = createWorkflow(
  "create-vendor-refund-reason",
  (input: CreateVendorRefundReasonWorkflowInput) => {
    const created = createRefundReasonsWorkflow.runAsStep({
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
        [Modules.PAYMENT]: { refund_reason_id: data.created[0].id },
      },
    ])

    createRemoteLinkStep(linksToCreate)

    return new WorkflowResponse({ refund_reason: created[0] })
  }
)
