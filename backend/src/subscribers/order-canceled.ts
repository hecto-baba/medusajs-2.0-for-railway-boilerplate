import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework"
import { cancelOrderWorkflow } from "@medusajs/medusa/core-flows"
import { updateRentalWorkflow } from "../workflows/update-rental"
import { MARKETPLACE_MODULE } from "../modules/marketplace"
import { withParentLineItemIds } from "../lib/split-order"

/**
 * When an order is canceled:
 *  - its rentals are cancelled. A seller's CHILD order carries copies of the
 *    parent's line items, so its rentals are found through
 *    metadata.parent_line_item_id; the parent's are found by order id.
 *  - the seller's payout ledger entry for a canceled child becomes void
 *  - canceling the PARENT (the order the buyer paid for) cancels every seller's
 *    child order too, which voids their entries
 * Only entries still "owed" are voided: a paid entry is final and needs a human.
 */
export default async function orderCanceledHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")
  const query = container.resolve("query")
  const marketplace: any = container.resolve(MARKETPLACE_MODULE)

  logger.info(`Processing cancellation of order ${data.id}`)

  try {
    const {
      data: [order],
    } = await query.graph({
      entity: "order",
      fields: ["id", "metadata", "items.id", "items.metadata"],
      filters: { id: data.id },
    })

    const isChild = !!(order as any)?.metadata?.split_child

    // --- ledger and child orders
    if (isChild) {
      const [entry] = await marketplace.listVendorOrderSplits({ child_order_id: data.id })
      if (entry && entry.payout_status === "owed") {
        await marketplace.updateVendorOrderSplits({ id: entry.id, payout_status: "void" })
      }
    } else {
      const children: any[] = await marketplace.listVendorOrderSplits({ parent_order_id: data.id })
      for (const child of children) {
        try {
          await cancelOrderWorkflow(container).run({ input: { order_id: child.child_order_id } })
        } catch (error: any) {
          // A child that cannot be canceled (already fulfilled) needs a person.
          logger.error(`Could not cancel seller order ${child.child_order_id}: ${error.message}`)
          continue
        }
        if (child.payout_status === "owed") {
          await marketplace.updateVendorOrderSplits({ id: child.id, payout_status: "void" })
        }
      }
    }

    // --- rentals
    const rentalFilter: Record<string, unknown> = { status: { $ne: "cancelled" } }
    if (isChild) {
      const lineItemIds = ((order as any)?.items ?? []).map((item: any) => item.id)
      rentalFilter.line_item_id = await withParentLineItemIds(container, lineItemIds)
    } else {
      rentalFilter.order_id = data.id
    }

    const { data: rentals } = await query.graph({
      entity: "rental",
      fields: ["id", "status"],
      filters: rentalFilter,
    })

    if (!rentals || rentals.length === 0) {
      logger.info(`No rentals found for order ${data.id}`)
      return
    }

    logger.info(`Found ${rentals.length} rental(s) to cancel for order ${data.id}`)

    let successCount = 0
    let errorCount = 0

    for (const rental of rentals) {
      try {
        await updateRentalWorkflow(container).run({
          input: { rental_id: (rental as any).id, status: "cancelled" },
        })
        successCount++
        logger.info(`Cancelled rental ${(rental as any).id}`)
      } catch (error) {
        errorCount++
        logger.error(`Failed to cancel rental ${(rental as any).id}: ${error.message}`)
      }
    }

    logger.info(
      `Rental cancellation complete for order ${data.id}: ${successCount} succeeded, ${errorCount} failed`
    )
  } catch (error) {
    logger.error(`Error in orderCanceledHandler: ${error.message}`)
  }
}

export const config: SubscriberConfig = {
  event: "order.canceled",
}
