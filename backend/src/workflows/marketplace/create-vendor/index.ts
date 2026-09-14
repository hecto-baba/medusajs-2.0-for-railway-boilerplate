import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  setAuthAppMetadataStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { createVendorStep } from "./steps/create-vendor"
import { createVendorAdminStep } from "./steps/create-vendor-admin"

export type CreateVendorWorkflowInput = {
  name: string
  handle?: string
  logo?: string
  admin: {
    email: string
    first_name?: string
    last_name?: string
  }
  authIdentityId: string
}

export const createVendorWorkflow = createWorkflow(
  "create-vendor",
  (input: CreateVendorWorkflowInput) => {
    const vendor = createVendorStep({
      name: input.name,
      handle: input.handle,
      logo: input.logo,
    })

    const vendorAdminData = transform({ input, vendor }, (data) => ({
      ...data.input.admin,
      vendor_id: data.vendor.id,
    }))

    const vendorAdmin = createVendorAdminStep(vendorAdminData)

    /**
     * Writes the admin's id to the auth identity's app_metadata under
     * vendor_id. That mapping is what lets authenticate("vendor", ...) later
     * resolve req.auth_context.actor_id on every vendor route - without it the
     * admin exists but can never log in.
     */
    setAuthAppMetadataStep({
      authIdentityId: input.authIdentityId,
      actorType: "vendor",
      value: vendorAdmin.id,
    })

    const { data: vendors } = useQueryGraphStep({
      entity: "vendor",
      fields: ["id", "name", "handle", "logo", "admins.*"],
      filters: { id: vendor.id },
    }).config({ name: "retrieve-vendor" })

    return new WorkflowResponse({ vendor: vendors[0] })
  }
)
