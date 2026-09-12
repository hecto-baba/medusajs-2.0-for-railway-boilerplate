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
    /**
     * Vendor.handle is a required, unique column, but the route's schema
     * accepts the field as optional - so a request that omits it used to
     * reach the ORM as undefined and fail the whole workflow with a bare
     * validation error. Deriving a slug from the name honours the contract
     * the route already advertises.
     *
     * The timestamp suffix is what keeps the unique constraint satisfied:
     * two stores legitimately called "Acme" would otherwise collide, and a
     * collision here surfaces to the vendor as an opaque 500 during signup.
     */
    const vendorInput = transform({ input }, (data) => {
      const slug = (data.input.handle ?? data.input.name)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")

      return {
        name: data.input.name,
        handle: data.input.handle ?? `${slug || "vendor"}-${Date.now().toString(36)}`,
        logo: data.input.logo,
      }
    })

    const vendor = createVendorStep(vendorInput)

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
    })

    return new WorkflowResponse({ vendor: vendors[0] })
  }
)
