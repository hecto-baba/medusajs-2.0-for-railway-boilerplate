import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  createVendorWorkflow,
  type CreateVendorWorkflowInput,
} from "../../workflows/marketplace/create-vendor"

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

  const rawHandle =
    req.validatedBody.handle ||
    req.validatedBody.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")

  const cleanHandle = (rawHandle || `vendor-${Date.now()}`).toLowerCase()

  try {
    const { result } = await createVendorWorkflow(req.scope).run({
      input: {
        ...req.validatedBody,
        name: req.validatedBody.name.trim(),
        handle: cleanHandle,
        authIdentityId: req.auth_context.auth_identity_id,
      } as CreateVendorWorkflowInput,
    })

    res.json({ vendor: result.vendor })
  } catch (err: any) {
    if (
      err?.code === "23505" ||
      err?.message?.includes("unique") ||
      err?.message?.includes("already exists")
    ) {
      throw new MedusaError(
        MedusaError.Types.DUPLICATE_ERROR,
        "A vendor with this handle or email already exists. Please choose a different handle or login with your existing account."
      )
    }
    throw err
  }
}

