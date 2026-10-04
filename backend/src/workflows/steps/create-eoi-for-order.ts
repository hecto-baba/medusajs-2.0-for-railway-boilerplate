import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { EOI_MODULE } from "../../modules/expression-of-interest"
import ExpressionOfInterestModuleService from "../../modules/expression-of-interest/service"
import { OrderDTO } from "@medusajs/framework/types"
import { persistEoisForOrder } from "../../utils/persist-eois-for-order"

export type CreateEoiForOrderInput = {
  order: OrderDTO
}

/**
 * Mirrors create-rentals-for-order.ts: filters order.items for the
 * is_eoi metadata flag stamped by add-to-cart-with-eoi, and persists one Eoi
 * row per matching line item, reading the snapshotted metadata rather than
 * re-deriving from current config - so the record reflects exactly what was
 * quoted and charged at add-to-cart time, not whatever the product's EOI
 * configuration says by the time checkout completes.
 *
 * The persistence itself lives in persistEoisForOrder, which never throws:
 * this step runs after completeCartWorkflow has already placed the order, so
 * a failure here would otherwise roll back an order whose payment is already
 * authorized. Anything skipped is retried by the order.placed subscriber.
 */
export const createEoiForOrderStep = createStep(
  "create-eoi-for-order",
  async ({ order }: CreateEoiForOrderInput, { container }) => {
    const eois = await persistEoisForOrder(container, order)

    return new StepResponse(
      eois,
      eois.map((eoi) => eoi.id)
    )
  },
  async (eoiIds, { container }) => {
    if (!eoiIds?.length) return

    const eoiModuleService: ExpressionOfInterestModuleService =
      container.resolve(EOI_MODULE)

    // Delete all created EOI rows on rollback
    await eoiModuleService.deleteEois(eoiIds)
  }
)
