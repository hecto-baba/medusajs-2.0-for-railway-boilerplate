import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  deleteShippingProfileWorkflow,
  updateShippingProfilesWorkflow,
} from "@medusajs/medusa/core-flows"
import { z } from "@medusajs/framework/zod"

export const UpdateVendorShippingProfileSchema = z.object({
  name: z.string().optional(),
  type: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: shippingProfiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id", "name", "type", "metadata", "created_at", "updated_at"],
    filters: { id },
  })

  if (!shippingProfiles || shippingProfiles.length === 0) {
    return res.status(404).json({ message: `Shipping profile ${id} not found` })
  }

  res.json({ shipping_profile: shippingProfiles[0] })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof UpdateVendorShippingProfileSchema>>,
  res: MedusaResponse
) => {
  const { id } = req.params

  await (updateShippingProfilesWorkflow(req.scope) as any).run({
    input: {
      selector: { id },
      update: req.validatedBody || req.body,
    },
  })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: shippingProfiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id", "name", "type", "metadata", "created_at", "updated_at"],
    filters: { id },
  })

  res.json({ shipping_profile: shippingProfiles?.[0] })
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params

  try {
    const fulfillmentModuleService = req.scope.resolve(Modules.FULFILLMENT)
    await (fulfillmentModuleService as any).retrieveShippingProfile(id)

    await (deleteShippingProfileWorkflow(req.scope) as any).run({
      input: { ids: [id] },
    })

    res.status(200).json({
      id,
      object: "shipping_profile",
      deleted: true,
    })
  } catch (error: any) {
    res.status(400).json({
      message: error?.message || "Failed to delete shipping profile",
    })
  }
}
