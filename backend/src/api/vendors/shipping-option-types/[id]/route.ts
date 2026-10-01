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
import { assertVendorCanSee, ScopedEntity } from "../../shared/platform-scope"
import { assertVendorOwns } from "../../shared/vendor-scope"

const SHIPPING_OPTION_TYPES: ScopedEntity = {
  linkField: "shipping_option_types",
  entity: "shipping_option_type",
}

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

  // Own or shared platform type; another seller's type is a 404.
  await assertVendorCanSee(req, SHIPPING_OPTION_TYPES, id, "Shipping option type not found.")

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

  await assertVendorOwns(req, "shipping_option_types", id, "Shipping option type not found.")

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

  await assertVendorOwns(req, "shipping_option_types", id, "Shipping option type not found.")

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
