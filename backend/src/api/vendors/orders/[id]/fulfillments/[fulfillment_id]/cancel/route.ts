import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { cancelOrderFulfillmentWorkflow } from "@medusajs/medusa/core-flows"
import {
  assertFulfillmentBelongsToOrder,
  assertVendorOwnsOrder,
  loadSellerOrder,
  parseBody,
} from "../../../../actions"

const BodySchema = z.object({ no_notification: z.boolean().optional() }).strict()

/** Cancels a fulfilment of the seller's own order; the stock goes back to their location. */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id, fulfillment_id } = req.params
  const body = parseBody(BodySchema, req.body)

  await assertVendorOwnsOrder(req, id)
  const order = await loadSellerOrder(req, id)
  assertFulfillmentBelongsToOrder(order, fulfillment_id)

  await cancelOrderFulfillmentWorkflow(req.scope).run({
    input: {
      order_id: id,
      fulfillment_id,
      no_notification: body.no_notification,
    },
  })

  res.json({ canceled: true, fulfillment_id })
}
