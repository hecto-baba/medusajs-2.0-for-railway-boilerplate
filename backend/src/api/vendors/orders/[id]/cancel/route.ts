import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { cancelOrderWorkflow } from "@medusajs/medusa/core-flows"
import {
  assertOrderNotShared,
  assertVendorOwnsOrder,
  loadSellerOrder,
  parseBody,
} from "../../actions"

const BodySchema = z.object({ no_notification: z.boolean().optional() }).strict()

/**
 * Cancels the seller's own order. A child order is cancelled on its own: the
 * subscriber voids its ledger entry and cancels its rentals; the buyer's parent
 * order and the other sellers' orders are untouched. An older shared order is
 * refused (it would cancel other sellers' items too).
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const body = parseBody(BodySchema, req.body)

  await assertVendorOwnsOrder(req, id)
  const order = await loadSellerOrder(req, id)
  assertOrderNotShared(order)

  await cancelOrderWorkflow(req.scope).run({
    input: { order_id: id, no_notification: body.no_notification, canceled_by: req.auth_context.actor_id },
  } as any)

  res.json({ canceled: true, order_id: id })
}
