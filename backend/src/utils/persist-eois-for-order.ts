import { MedusaContainer } from "@medusajs/framework/types"
import { EOI_MODULE } from "../modules/expression-of-interest"
import ExpressionOfInterestModuleService from "../modules/expression-of-interest/service"

type OrderLike = {
  id: string
  email?: string | null
  customer_id?: string | null
  items?: any[] | null
}

const toFiniteNumber = (value: unknown): number | null => {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * Persists one Eoi row per EOI-flagged order line, from the snapshot the
 * add-to-cart workflow stamped into the line's metadata.
 *
 * Idempotent and non-throwing by design. The order is already placed (and
 * payment authorized) by the time this runs, so a bad snapshot or a transient
 * failure must never be able to fail the checkout - it is logged and skipped,
 * and the next run (order.placed subscriber, or a retry of the workflow)
 * picks up whatever is still missing.
 */
export async function persistEoisForOrder(
  container: MedusaContainer,
  order: OrderLike
) {
  const logger = container.resolve("logger")

  const eoiItems = (order.items || []).filter(
    (item) => item?.metadata?.is_eoi === true
  )
  if (!eoiItems.length) {
    return []
  }

  const eoiModuleService: ExpressionOfInterestModuleService =
    container.resolve(EOI_MODULE)

  try {
    const existing = await eoiModuleService.listEois(
      { order_id: order.id },
      { select: ["id", "line_item_id"] }
    )
    const alreadyPersisted = new Set(existing.map((eoi) => eoi.line_item_id))

    const rows: Parameters<typeof eoiModuleService.createEois>[0] = []

    for (const item of eoiItems) {
      if (alreadyPersisted.has(item.id)) {
        continue
      }

      const metadata = item.metadata ?? {}
      const productId = item.product_id ?? item.variant?.product_id
      const valueAmount = toFiniteNumber(metadata.eoi_value_amount)
      const quotedUnitPrice = toFiniteNumber(metadata.eoi_quoted_unit_price)
      const chargedAmount = toFiniteNumber(metadata.eoi_charged_amount)
      const remainingAmount = toFiniteNumber(metadata.eoi_remaining_amount)
      const valueType = metadata.eoi_value_type

      const valid =
        typeof productId === "string" &&
        typeof item.variant_id === "string" &&
        typeof order.email === "string" &&
        order.email.length > 0 &&
        (valueType === "fixed" || valueType === "percentage") &&
        valueAmount !== null &&
        quotedUnitPrice !== null &&
        chargedAmount !== null &&
        remainingAmount !== null &&
        valueAmount >= 0 &&
        quotedUnitPrice > 0 &&
        chargedAmount >= 0 &&
        chargedAmount <= quotedUnitPrice &&
        remainingAmount >= 0

      if (!valid) {
        logger.warn(
          `persistEoisForOrder: skipping line item ${item.id} on order ${order.id} - missing or invalid EOI snapshot`
        )
        continue
      }

      // EOI lines are meant to be quantity 1 (enforced at add-to-cart). If a
      // line was still bumped through the stock cart routes, record what the
      // customer actually paid rather than a single unit's worth.
      const quantity = Math.max(1, toFiniteNumber(item.quantity) ?? 1)
      if (quantity > 1) {
        logger.warn(
          `persistEoisForOrder: line item ${item.id} on order ${order.id} has quantity ${quantity}; scaling EOI amounts`
        )
      }

      rows.push({
        product_id: productId,
        variant_id: item.variant_id,
        customer_id: order.customer_id ?? null,
        customer_email: order.email as string,
        cart_id: null,
        order_id: order.id,
        line_item_id: item.id,
        value_type: valueType,
        value_amount: valueAmount,
        quoted_unit_price: quotedUnitPrice,
        eoi_charged_amount: chargedAmount * quantity,
        remaining_amount: remainingAmount * quantity,
        status: "converted" as const,
      })
    }

    if (!rows.length) {
      return []
    }

    return await eoiModuleService.createEois(rows)
  } catch (error) {
    logger.error(
      `persistEoisForOrder: failed for order ${order.id}: ${(error as Error).message}`
    )
    return []
  }
}

export default persistEoisForOrder
