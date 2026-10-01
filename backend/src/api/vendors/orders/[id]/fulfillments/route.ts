import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { createOrderFulfillmentWorkflow } from "@medusajs/medusa/core-flows"
import {
  assertItemsBelongToOrder,
  assertLocationIsOwn,
  assertShippingOptionForOrder,
  assertVendorOwnsOrder,
  loadSellerOrder,
  parseBody,
} from "../../actions"

export const CreateVendorFulfillmentSchema = z
  .object({
    items: z.array(z.object({ id: z.string().min(1), quantity: z.number().int().min(1) }).strict()).min(1),
    // Explicit on purpose: Medusa falls back to the order's FIRST shipping method.
    shipping_option_id: z.string().min(1),
    location_id: z.string().min(1).optional(),
    no_notification: z.boolean().optional(),
  })
  .strict()

/**
 * Packs items of the seller's own order. The items, the shipping option and the
 * location are all checked as the seller's (see ../../actions.ts); the stock is
 * taken from the seller's location by Medusa's own workflow.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const body = parseBody(CreateVendorFulfillmentSchema, req.body)

  await assertVendorOwnsOrder(req, id)
  const order = await loadSellerOrder(req, id)

  assertItemsBelongToOrder(order, body.items.map((item) => item.id))
  await assertShippingOptionForOrder(req, order, body.shipping_option_id)
  if (body.location_id) {
    await assertLocationIsOwn(req, body.location_id)
  }

  const { result } = await createOrderFulfillmentWorkflow(req.scope).run({
    input: {
      order_id: id,
      items: body.items,
      shipping_option_id: body.shipping_option_id,
      location_id: body.location_id,
      no_notification: body.no_notification,
      created_by: req.auth_context.actor_id,
    },
  })

  res.status(201).json({ fulfillment: result })
}
