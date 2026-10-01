import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { refundPaymentWorkflow } from "@medusajs/medusa/core-flows"
import { MARKETPLACE_MODULE } from "../../../../../modules/marketplace"
import {
  assertOrderNotShared,
  assertVendorOwnsOrder,
  getLedgerEntry,
  loadSellerOrder,
  parseBody,
} from "../../actions"

const BodySchema = z
  .object({
    amount: z.number().positive(),
    note: z.string().max(500).optional(),
  })
  .strict()

const toNumber = (value: any): number => {
  if (value === null || value === undefined) return 0
  if (typeof value === "number") return value
  if (typeof value === "object") return toNumber(value.numeric_ ?? value.value ?? value.raw_?.value)
  const parsed = Number(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

/**
 * Refunds the buyer for the seller's own order.
 *
 * The buyer paid ONCE, on the parent order, so for a child order the money is
 * returned through the parent's payment, capped at what that seller's order is
 * worth (its ledger total minus what was already refunded): a seller can never
 * refund more than their own share, nor touch other sellers' money. The refund
 * is recorded on the ledger entry. An order that is wholly the seller's is
 * refunded against its own payment. An older shared order is refused.
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

  const entry = await getLedgerEntry(req, id)
  const paymentOrderId = entry ? entry.parent_order_id : id

  if (entry) {
    const remaining = round(Number(entry.total) - Number(entry.refunded_total ?? 0))
    if (body.amount > remaining) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `You can refund at most ${remaining} ${order.currency_code.toUpperCase()} on this order.`
      )
    }
  }

  // The payment to refund from: a captured one with enough left.
  const query: any = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: payments } = await query.graph({
    entity: "order",
    fields: ["id", "payment_collections.payments.id", "payment_collections.payments.amount", "payment_collections.payments.captured_at", "payment_collections.payments.refunds.amount"],
    filters: { id: paymentOrderId },
  })
  const candidates = ((payments?.[0]?.payment_collections ?? []) as any[])
    .flatMap((collection) => collection.payments ?? [])
    .filter((payment) => payment.captured_at)
    .map((payment) => ({
      id: payment.id as string,
      left: toNumber(payment.amount) - ((payment.refunds ?? []) as any[]).reduce((sum, r) => sum + toNumber(r.amount), 0),
    }))
    .filter((payment) => payment.left >= body.amount)

  if (!candidates.length) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "There is no captured payment with enough left to refund this amount."
    )
  }

  await refundPaymentWorkflow(req.scope).run({
    input: {
      payment_id: candidates[0].id,
      amount: body.amount,
      note: body.note,
      created_by: req.auth_context.actor_id,
    },
  })

  if (entry) {
    const marketplace: any = req.scope.resolve(MARKETPLACE_MODULE)
    await marketplace.updateVendorOrderSplits({
      id: entry.id,
      refunded_total: round(Number(entry.refunded_total ?? 0) + body.amount),
    })
  }

  res.status(201).json({ refunded: body.amount, order_id: id })
}
