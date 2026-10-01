import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { markOrderFulfillmentAsDeliveredWorkflow } from "@medusajs/medusa/core-flows"
import {
  assertFulfillmentBelongsToOrder,
  assertVendorOwnsOrder,
  loadSellerOrder,
  parseBody,
} from "../../../../actions"

const BodySchema = z.object({ no_notification: z.boolean().optional() }).strict()

/** Marks a shipped fulfilment of the seller's own order as delivered. */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id, fulfillment_id } = req.params
  const body = parseBody(BodySchema, req.body)

  await assertVendorOwnsOrder(req, id)
  const order = await loadSellerOrder(req, id)
  assertFulfillmentBelongsToOrder(order, fulfillment_id)

  await markOrderFulfillmentAsDeliveredWorkflow(req.scope).run({
    input: {
      orderId: id,
      fulfillmentId: fulfillment_id,
      no_notification: body.no_notification,
    },
  } as any)

  res.json({ delivered: true, fulfillment_id })
}
