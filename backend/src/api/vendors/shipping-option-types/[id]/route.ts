import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  deleteShippingOptionTypesWorkflow,
  updateShippingOptionTypesWorkflow,
} from "@medusajs/medusa/core-flows"
import { z } from "@medusajs/framework/zod"

export const UpdateVendorShippingOptionTypeSchema = z.object({
  label: z.string().optional(),
  code: z.string().optional(),
  description: z.string().optional(),
})

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: optionTypes } = await query.graph({
    entity: "shipping_option_type",
    fields: ["id", "label", "code", "description", "created_at", "updated_at"],
    filters: { id },
  })

  if (!optionTypes || optionTypes.length === 0) {
    return res.status(404).json({ message: `Shipping option type ${id} not found` })
  }

  res.json({ shipping_option_type: optionTypes[0] })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof UpdateVendorShippingOptionTypeSchema>>,
  res: MedusaResponse
) => {
  const { id } = req.params

  await (updateShippingOptionTypesWorkflow(req.scope) as any).run({
    input: {
      selector: { id },
      update: req.validatedBody || req.body,
    },
  })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: optionTypes } = await query.graph({
    entity: "shipping_option_type",
    fields: ["id", "label", "code", "description", "created_at", "updated_at"],
    filters: { id },
  })

  res.json({ shipping_option_type: optionTypes?.[0] })
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params

  try {
    await (deleteShippingOptionTypesWorkflow(req.scope) as any).run({
      input: { ids: [id] },
    })

    res.status(200).json({
      id,
      object: "shipping_option_type",
      deleted: true,
    })
  } catch (error: any) {
    res.status(400).json({
      message: error?.message || "Failed to delete shipping option type",
    })
  }
}
