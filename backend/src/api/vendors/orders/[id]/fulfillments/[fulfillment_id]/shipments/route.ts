import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { createOrderShipmentWorkflow } from "@medusajs/medusa/core-flows"
import {
  assertFulfillmentBelongsToOrder,
  assertItemsBelongToOrder,
  assertVendorOwnsOrder,
  loadSellerOrder,
  parseBody,
} from "../../../../actions"

export const CreateVendorShipmentSchema = z
  .object({
    // Default: everything in the fulfilment.
    items: z.array(z.object({ id: z.string().min(1), quantity: z.number().int().min(1) }).strict()).min(1).optional(),
    labels: z
      .array(
        z
          .object({
            tracking_number: z.string().min(1),
            tracking_url: z.string().default(""),
            label_url: z.string().default(""),
          })
          .strict()
      )
      .optional(),
    no_notification: z.boolean().optional(),
  })
  .strict()

/** Marks a fulfilment of the seller's own order as shipped, with tracking. */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id, fulfillment_id } = req.params
  const body = parseBody(CreateVendorShipmentSchema, req.body)

  await assertVendorOwnsOrder(req, id)
  const order = await loadSellerOrder(req, id)
  assertFulfillmentBelongsToOrder(order, fulfillment_id)

  let items = body.items
  if (items) {
    assertItemsBelongToOrder(order, items.map((item) => item.id))
  } else {
    const query: any = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "fulfillment",
      fields: ["id", "items.line_item_id", "items.quantity"],
      filters: { id: fulfillment_id },
    })
    const byLine = new Map<string, number>()
    for (const item of (data?.[0]?.items ?? []) as any[]) {
      byLine.set(item.line_item_id, (byLine.get(item.line_item_id) ?? 0) + Number(item.quantity))
    }
    items = [...byLine.entries()].map(([id2, quantity]) => ({ id: id2, quantity }))
    assertItemsBelongToOrder(order, items.map((item) => item.id))
  }

  await createOrderShipmentWorkflow(req.scope).run({
    input: {
      order_id: id,
      fulfillment_id,
      items,
      labels: body.labels ?? [],
      no_notification: body.no_notification,
      created_by: req.auth_context.actor_id,
    },
  })

  res.status(201).json({ shipped: true, fulfillment_id })
}
