import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  createRemoteLinkStep,
  createShippingOptionTypesWorkflow,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import { MARKETPLACE_MODULE } from "../modules/marketplace"

export type CreateVendorShippingOptionTypeWorkflowInput = {
  vendor_admin_id: string
  shipping_option_type: { label: string; code: string; description?: string }
}

/**
 * Creates a shipping option type and links it to the calling seller, so it is
 * theirs alone: only they can edit or delete it, and no other seller sees it.
 */
export const createVendorShippingOptionTypeWorkflow = createWorkflow(
  "create-vendor-shipping-option-type",
  (input: CreateVendorShippingOptionTypeWorkflowInput) => {
    const createData = transform({ input }, (data) => ({
      shipping_option_types: [data.input.shipping_option_type],
    }))

    const created = createShippingOptionTypesWorkflow.runAsStep({
      input: createData as any,
    })

    const { data: vendorAdmins } = useQueryGraphStep({
      entity: "vendor_admin",
      fields: ["vendor.id"],
      filters: { id: input.vendor_admin_id },
    }).config({ name: "retrieve-vendor-admin-for-shipping-option-type" })

    const links = transform({ created, vendorAdmins }, (data) => {
      const vendorId = data.vendorAdmins?.[0]?.vendor?.id
      if (!vendorId) {
        throw new Error(
          "Cannot link shipping option type: authenticated vendor profile does not exist."
        )
      }

      return (data.created as any[]).map((type) => ({
        [MARKETPLACE_MODULE]: { vendor_id: vendorId },
        [Modules.FULFILLMENT]: { shipping_option_type_id: type.id },
      }))
    })

    createRemoteLinkStep(links)

    const result = transform({ created }, (data) => ({
      shipping_option_type: (data.created as any[])[0],
    }))

    return new WorkflowResponse(result)
  }
)
