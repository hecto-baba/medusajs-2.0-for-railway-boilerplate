import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  createRemoteLinkStep,
  createShippingProfilesWorkflow,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import { MARKETPLACE_MODULE } from "../modules/marketplace"

export type CreateVendorShippingProfileWorkflowInput = {
  vendor_admin_id: string
  shipping_profile: { name: string; type: string; metadata?: Record<string, unknown> }
}

/**
 * Creates a shipping profile and links it to the calling seller, so it is
 * theirs alone: only they can edit or delete it, and no other seller sees it.
 */
export const createVendorShippingProfileWorkflow = createWorkflow(
  "create-vendor-shipping-profile",
  (input: CreateVendorShippingProfileWorkflowInput) => {
    const createData = transform({ input }, (data) => ({
      data: [data.input.shipping_profile],
    }))

    const created = createShippingProfilesWorkflow.runAsStep({
      input: createData as any,
    })

    const { data: vendorAdmins } = useQueryGraphStep({
      entity: "vendor_admin",
      fields: ["vendor.id"],
      filters: { id: input.vendor_admin_id },
    }).config({ name: "retrieve-vendor-admin-for-shipping-profile" })

    const links = transform({ created, vendorAdmins }, (data) => {
      const vendorId = data.vendorAdmins?.[0]?.vendor?.id
      if (!vendorId) {
        throw new Error(
          "Cannot link shipping profile: authenticated vendor profile does not exist."
        )
      }

      return (data.created as any[]).map((profile) => ({
        [MARKETPLACE_MODULE]: { vendor_id: vendorId },
        [Modules.FULFILLMENT]: { shipping_profile_id: profile.id },
      }))
    })

    createRemoteLinkStep(links)

    const result = transform({ created }, (data) => ({
      shipping_profile: (data.created as any[])[0],
    }))

    return new WorkflowResponse(result)
  }
)
