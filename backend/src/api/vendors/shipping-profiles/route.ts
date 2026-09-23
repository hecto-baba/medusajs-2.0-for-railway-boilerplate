import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { createShippingProfilesWorkflow } from "@medusajs/medusa/core-flows"

export const CreateVendorShippingProfileSchema = z.object({
  name: z.string().min(1),
  type: z.string().default("default"),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: shippingProfiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id", "name", "type", "metadata", "created_at", "updated_at"],
    pagination: { order: { created_at: "ASC" } },
  })

  res.json({ shipping_profiles: shippingProfiles })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof CreateVendorShippingProfileSchema>>,
  res: MedusaResponse
) => {
  const { result } = await createShippingProfilesWorkflow(req.scope).run({
    input: {
      data: [req.validatedBody as any],
    },
  })

  res.status(201).json({ shipping_profile: result[0] })
}
