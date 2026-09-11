import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  createVendorWorkflow,
  type CreateVendorWorkflowInput,
} from "../../workflows/create-vendor"

export const PostVendorCreateSchema = z.strictObject({
  name: z.string().min(1, "A vendor name is required"),
  handle: z.string().min(1).optional(),
  logo: z.string().optional(),
  admin: z.strictObject({
    email: z.string().email("A valid admin email is required"),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
  }),
})

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof PostVendorCreateSchema>>,
  res: MedusaResponse
) => {
  // The middleware admits unregistered identities here so a fresh registration
  // token can reach this route. An actor_id means the token belongs to a vendor
  // admin that already exists, so this would be a second registration.
  if (req.auth_context?.actor_id) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Request already authenticated as a vendor."
    )
  }

  const { result } = await createVendorWorkflow(req.scope).run({
    input: {
      ...req.validatedBody,
      authIdentityId: req.auth_context.auth_identity_id,
    } as CreateVendorWorkflowInput,
  })

  res.status(201).json(result)
}
