import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import {
  beginReceiveReturnWorkflow,
  beginReturnOrderWorkflow,
  confirmReturnReceiveWorkflow,
  confirmReturnRequestWorkflow,
  receiveItemReturnRequestWorkflow,
  requestItemReturnWorkflow,
} from "@medusajs/medusa/core-flows"
import { assertVendorCanSee, ScopedEntity } from "../../../shared/platform-scope"
import {
  assertItemsBelongToOrder,
  assertLocationIsOwn,
  assertOrderNotShared,
  assertVendorOwnsOrder,
  loadSellerOrder,
  parseBody,
} from "../../actions"

const RETURN_REASONS: ScopedEntity = { linkField: "return_reasons", entity: "return_reason" }

const BodySchema = z
  .object({
    items: z
      .array(
        z
          .object({
            id: z.string().min(1),
            quantity: z.number().int().min(1),
            reason_id: z.string().min(1).optional(),
            note: z.string().max(500).optional(),
          })
          .strict()
      )
      .min(1),
    note: z.string().max(500).optional(),
    // true = the goods are back at the seller's location now, so stock is restored.
    receive_now: z.boolean().optional(),
    location_id: z.string().min(1).optional(),
  })
  .strict()

/**
 * Records a return of items of the seller's own order, optionally already
 * received at one of their own locations. Money is returned separately, with
 * POST .../refunds, so the seller decides the amount. An older shared order is
 * refused.
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
  assertItemsBelongToOrder(order, body.items.map((item) => item.id))

  for (const reasonId of new Set(body.items.map((item) => item.reason_id).filter((r): r is string => !!r))) {
    await assertVendorCanSee(req, RETURN_REASONS, reasonId, "Return reason not found.")
  }
  if (body.location_id) {
    await assertLocationIsOwn(req, body.location_id)
  }

  // The standard admin sequence: open a return, add the items, confirm the request,
  // and (if the goods are already back) receive them. Medusa's one-shot "create and
  // complete" workflow needs a RETURN shipping option, which sellers do not have.
  const actor = req.auth_context.actor_id

  const { result: opened } = await beginReturnOrderWorkflow(req.scope).run({
    input: { order_id: id, location_id: body.location_id, created_by: actor } as any,
  })
  // The workflow returns the order change; the return itself is its return_id.
  const returnId = (opened as any).return_id

  await requestItemReturnWorkflow(req.scope).run({
    input: {
      return_id: returnId,
      items: body.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        reason_id: item.reason_id,
        internal_note: item.note,
      })),
    } as any,
  })

  await confirmReturnRequestWorkflow(req.scope).run({
    input: { return_id: returnId, confirmed_by: actor } as any,
  })

  if (body.receive_now) {
    await beginReceiveReturnWorkflow(req.scope).run({
      input: { return_id: returnId, created_by: actor } as any,
    })
    await receiveItemReturnRequestWorkflow(req.scope).run({
      input: {
        return_id: returnId,
        items: body.items.map((item) => ({ id: item.id, quantity: item.quantity })),
      } as any,
    })
    await confirmReturnReceiveWorkflow(req.scope).run({
      input: { return_id: returnId, confirmed_by: actor } as any,
    })
  }

  const result = { id: returnId, received: !!body.receive_now }

  res.status(201).json({ return: result })
}
