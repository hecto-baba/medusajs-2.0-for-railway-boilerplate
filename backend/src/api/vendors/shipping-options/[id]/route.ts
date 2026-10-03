import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  deleteShippingOptionsWorkflow,
  updateShippingOptionsWorkflow,
} from "@medusajs/medusa/core-flows"
import { assertVendorOwnsShippingOption } from "../../shared/shipping-option-scope"
import {
  assertShippingOptionReferences,
  refetchShippingOption,
  UpdateVendorShippingOptionSchema,
} from "../helpers"

export { UpdateVendorShippingOptionSchema }

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params

  await assertVendorOwnsShippingOption(req, id)

  res.json({ shipping_option: await refetchShippingOption(req, id) })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof UpdateVendorShippingOptionSchema>>,
  res: MedusaResponse
) => {
  const { id } = req.params
  const body = req.validatedBody

  await assertVendorOwnsShippingOption(req, id)
  await assertShippingOptionReferences(req, body)

  // A price entry that names an id must be one of THIS option's prices; otherwise
  // it would rewrite a price on another seller's option.
  const priceIds = (body.prices ?? [])
    .map((price) => ("id" in price ? price.id : undefined))
    .filter((priceId): priceId is string => !!priceId)

  if (priceIds.length) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "shipping_option",
      fields: ["id", "prices.id"],
      filters: { id },
    })
    const own = new Set(((data?.[0] as any)?.prices ?? []).map((price: any) => price.id))
    if (!priceIds.every((priceId) => own.has(priceId))) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Shipping option price not found.")
    }
  }

  const { shipping_option_type_id, ...rest } = body

  await updateShippingOptionsWorkflow(req.scope).run({
    input: [
      {
        id,
        ...rest,
        ...(shipping_option_type_id ? { type_id: shipping_option_type_id } : {}),
      } as any,
    ],
  })

  res.json({ shipping_option: await refetchShippingOption(req, id) })
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params

  await assertVendorOwnsShippingOption(req, id)

  await deleteShippingOptionsWorkflow(req.scope).run({ input: { ids: [id] } })

  res.json({ id, object: "shipping_option", deleted: true })
}
